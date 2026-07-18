# ESA Energy — Billing Calculation Map

Fonte única de verdade: `calculadora_html.html` do repositório `esa-calculadora-energia`.  
Hash auditado: main branch, arquivo `index.html` (alias `calculadora_html.html`).  
Implementação JS adaptada em: `src/engines/energy-billing/legacy-copel-calculation-adapter.js`.

---

## 1. Inputs

| Legacy Variable | Significado                          | Origem                  | Tipo      | Exemplo       |
|-----------------|--------------------------------------|-------------------------|-----------|---------------|
| `consumo`       | Consumo faturado pela concessionária | Fatura mensal (kWh)     | `number`  | 223.085 kWh   |
| `cip`           | Contribuição de Iluminação Pública   | Fatura mensal (R$)      | `number`  | R$ 177.19     |
| `te_com`        | Tarifa de Energia **com** tributos   | Tabela ANEEL (R$/kWh)   | `number`  | 0.558035      |
| `te_sem`        | Tarifa de Energia **sem** tributos   | Tabela ANEEL (R$/kWh)   | `number`  | 0.558035      |
| `tusd_com`      | TUSD **com** tributos                | Tabela ANEEL (R$/kWh)   | `number`  | 0.678724      |
| `tus_sem`       | TUSD/TUS **sem** tributos (parcial)  | Tabela ANEEL (R$/kWh)   | `number`  | 0.291481      |
| `icms_pct`      | ICMS — já dividido por 100           | SEFAZ estadual          | `number`  | 0.19 (19%)    |
| `cofins_pct`    | COFINS — já dividido por 100         | Tabela PIS/COFINS       | `number`  | 0.057472      |
| `pis_pct`       | PIS — já dividido por 100            | Tabela PIS/COFINS       | `number`  | 0.012476      |
| `geracao`       | Geração total injetada pela UG       | Medição (kWh)           | `number`  | 185.93 kWh    |
| `uc_prop`       | Consumo próprio da UC geradora       | Medição/estimativa (kWh)| `number`  | 0 kWh         |
| `minimo`        | Custo mínimo faturável               | Contrato ESA (kWh)      | `number`  | 100 kWh       |
| `preco_kwh`     | Preço de venda kWh ESA               | Contrato ESA (R$/kWh)   | `number`  | **0.60**      |
| `desc_dist`     | Desconto distribuidor — dividido/100 | Negociação (%)          | `number`  | 0.0           |
| `bndv`          | Bandeira tarifária ANEEL             | ANEEL mensal (R$/kWh)   | `number`  | 0 (Verde)     |

> **CRÍTICO — `preco_kwh`:** O valor `0,60` significa **R$ 0,60/kWh** (sessenta centavos).  
> Nunca deve ser interpretado como R$ 60,00/kWh.  
> O parser monetário deve tratar vírgula como separador decimal (formato pt-BR).

---

## 2. Ordem de Cálculo

### 2.1 Conta Concessionária (COPEL Normal)

```
c_te    = consumo × (te_com + bndv)          # TE bruta + bandeira
c_tusd  = consumo × tusd_com                 # TUSD bruta
c_fat   = c_te + c_tusd + cip               # TOTAL CONTA NORMAL
```

> Arredondamento: nenhum intermediário. Display final usa `toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})`.

**Impostos Copel** (informativos, NÃO somados ao total):
```
c_base_icms    = c_te + c_tusd
c_icms         = c_base_icms × icms_pct
c_base_piscof  = c_base_icms - c_icms
c_cofins       = c_base_piscof × cofins_pct
c_pis          = c_base_piscof × pis_pct
c_imp          = c_icms + c_cofins + c_pis
```

> As tarifas `te_com` e `tusd_com` já incluem tributos. Os campos de impostos são decomposição informativa.

### 2.2 Créditos GD2 (compensação ESA)

```
cred_te      = consumo × (te_sem + bndv)      # crédito TE compensado
cred_tus     = consumo × tus_sem              # crédito TUS parcial
fio_b        = consumo × (tusd_com - tus_sem) # Fio B retido pela concessionária
gd2_te_liq   = c_te - cred_te                # = 0 se 100% compensado
gd2_tus_liq  = c_tusd - cred_tus             # = fio_b (parcela TUSD retida)
```

**Impostos GD2** (base de cálculo diferente da normal):
```
gd2_base_icms    = c_tusd                    # base ICMS = TUSD bruta, não líquida
gd2_icms         = gd2_base_icms × icms_pct
gd2_base_piscof  = gd2_tus_liq - gd2_icms
gd2_cofins       = gd2_base_piscof × cofins_pct
gd2_pis          = gd2_base_piscof × pis_pct
gd2_imp          = gd2_icms + gd2_cofins + gd2_pis
```

### 2.3 Venda de Créditos ESA

```
cred_disp      = max(geracao - uc_prop - minimo, 0)    # créditos disponíveis p/ distribuição
cred_comp_uc   = consumo                                # créditos compensados na UC
cred_excedente = max(cred_disp - cred_comp_uc, 0)     # excedentes (não compensados)
custo_min      = minimo × (te_com + bndv) + minimo × tusd_com + cip  # custo mínimo completo
rec_bruta      = cred_excedente × preco_kwh            # receita bruta excedente
rec_liq        = rec_bruta × (1 - desc_dist)           # receita líquida excedente

# Receita principal ESA:
venda_kwh      = (geracao - minimo) × preco_kwh        # kWh injetado acima do mínimo
custo_min_sc   = minimo × (te_com + bndv) + minimo × tusd_com  # custo mínimo SEM CIP
```

### 2.4 Conta ESA GD2 Final

```
gd2_liq_final = gd2_tus_liq + cip + venda_kwh + custo_min_sc
```

> **Composição do gd2_liq_final:**
> - `gd2_tus_liq` = Fio B (TUSD retida, R$)
> - `cip` = CIP (R$)
> - `venda_kwh` = (geracao - minimo) × preco_kwh
> - `custo_min_sc` = minimo × (te_com + bndv + tusd_com)

> ⚠ `gd2_imp` é mostrado separadamente mas **NÃO é somado** em `gd2_liq_final`.

### 2.5 Economia

```
eco_mensal = c_fat - gd2_liq_final
eco_pct    = (eco_mensal / c_fat) × 100     # percentual, se c_fat > 0
eco_anual  = eco_mensal × 12
```

---

## 3. Componentes Tarifários no Snapshot

| Campo Snapshot           | Fórmula Legacy          | Observação                         |
|--------------------------|-------------------------|------------------------------------|
| `contaConcessionaria.te` | `c_te`                  | TE bruta + bandeira                |
| `contaConcessionaria.tusd` | `c_tusd`              | TUSD bruta                         |
| `contaConcessionaria.cip`  | `cip`                 | CIP                                |
| `contaConcessionaria.total`| `c_fat`               | TE + TUSD + CIP                    |
| `contaEsa.fioB`          | `gd2_tus_liq`           | TUSD retida (Fio B)                |
| `contaEsa.cip`           | `cip`                   | CIP (idêntica)                     |
| `contaEsa.vendaKwh`      | `venda_kwh`             | (geracao - minimo) × preco_kwh     |
| `contaEsa.custoMinimoSemCip` | `custo_min_sc`      | minimo × (TE + TUSD)               |
| `contaEsa.total`         | `gd2_liq_final`         | Conta ESA final                    |
| `creditos.disponiveis`   | `cred_disp`             | Créditos disponíveis p/ clientes   |
| `creditos.compensados`   | `cred_comp_uc`          | = consumo (100% compensado)        |
| `creditos.excedentes`    | `cred_excedente`        | Não compensados no mês             |
| `creditos.vendaKwh`      | `geracao - minimo`      | kWh que geram receita              |

---

## 4. Regra dos Créditos Cobrados pela ESA

A fatura ESA **não cobra sobre consumo total × preço**. A lógica é:

1. Mínimo faturável (`minimo` kWh) — cobrado sempre
2. Créditos acima do mínimo (`geracao - minimo`) — cobrados ao `preco_kwh`
3. Créditos excedentes (`cred_excedente`) — podem gerar receita complementar (`rec_liq`)
4. Fio B — componente fixo da concessionária que permanece na conta ESA

> A fórmula `consumo × preco_kwh` é PROIBIDA como base da fatura ESA oficial.

---

## 5. Defaults Canônicos (calculadora)

```
cip      = R$ 177.19   (CIP comercial Copel referência)
te_com   = 0.558035    R$/kWh
te_sem   = 0.558035    R$/kWh
tusd_com = 0.678724    R$/kWh
tus_sem  = 0.291481    R$/kWh
icms     = 19%
cofins   = 5.7472%
pis      = 1.2476%
minimo   = 100 kWh
preco_kwh = R$ 0.60/kWh
desc_dist = 0%
bandeira = Verde (0)
```

---

## 6. Caso de Regressão Validado

Inputs que produzem os valores validados no Gerador de Propostas:

```
consumo  = 223.085 kWh
geracao  = 185.93 kWh
cip      = 177.19
te_com   = 0.558035
te_sem   = 0.558035
tusd_com = 0.678724
tus_sem  = 0.291481
bndv     = 0 (Verde)
minimo   = 100
preco_kwh = 0.60
desc_dist = 0
icms_pct  = 0.19
cofins_pct = 0.057472
pis_pct    = 0.012476
uc_prop    = 0
```

Saídas esperadas (display arredondado para 2 casas):

| Campo           | Valor     |
|-----------------|-----------|
| Conta Normal    | R$ 453,09 |
| Conta ESA       | R$ 438,81 |
| Economia Mensal | R$ 14,28  |
| Economia Anual  | R$ 171,36 |
| Economia %      | 3,15%     |

---

## 7. Divergências entre Core e Calculadora Legacy

| Tema                       | Core Atual (EnergyCreditsCalculator) | Calculadora Legacy          |
|----------------------------|--------------------------------------|-----------------------------|
| Base fatura sem ESA        | `billWithoutEsa = consumo × tariff`  | `c_fat = c_te + c_tusd + cip` — NÃO usa tarifa única |
| Base fatura com ESA        | `billWithEsa = esaInvoice + residual`| `gd2_liq_final` — fórmula composita com Fio B + CIP + venda + mínimo |
| Impostos                   | Não modelados explicitamente         | ICMS/PIS/COFINS decompostos |
| Bandeira tarifária         | Não modelada                         | `bndv` adicionada ao TE     |
| Fio B                      | Não modelado                         | `gd2_tus_liq = c_tusd - cred_tus` |
| Custo mínimo               | Não modelado                         | `custo_min_sc = minimo × (te_com + tusd_com)` |
| Mínimo faturável           | Campo operacional                    | Determina a fatura ESA inteira |
| Receita de créditos ESA    | `creditsKwh × price`                 | `(geracao - minimo) × preco_kwh` |

> ⚠ Estas divergências NÃO foram corrigidas no Core nesta missão. O Billing Engine é uma camada separada que implementa a calculadora legacy sem alterar o Core.
