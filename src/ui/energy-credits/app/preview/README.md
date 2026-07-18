# Preview Local — Gestão de Créditos ESA Energia

Harness de preview isolado para inspeção visual da UI nativa `ec-*` antes da montagem no dashboard legado.

---

## Como executar

A partir da raiz do repositório:

```bash
npx serve .
```

Em seguida, abra no navegador:

```
http://localhost:3000/src/ui/energy-credits/app/preview/energy-credits-preview.html
```

> Não é necessário instalar dependências adicionais. `npx serve` usa o `serve` do npm sem install permanente.

---

## Estrutura do harness

```
preview/
├── energy-credits-preview.html          Ponto de entrada (abrir no browser)
├── energy-credits-preview.js            Orquestrador: monta o app com provider falso
├── energy-credits-preview-provider.js   Provider falso — todos os 27 métodos UIResult
├── energy-credits-preview-data.js       Fixtures estáticos do cenário de preview
└── README.md                            Este arquivo
```

---

## Cenário de preview

| Item | Valor |
|---|---|
| Mês referência | 2026-07 |
| Unidade Geradora | UG Solar Assaí (ug-assai) |
| Capacidade instalada | 52,8 kWp |
| Geração do mês | 13.000 kWh |

### Beneficiárias e rateio

| Beneficiária | UC | % Rateio | Alocado (kWh) | Consumido (kWh) | Saldo (kWh) | Cobertura |
|---|---|---|---|---|---|---|
| Mercado Central | 7891234 | 32,3% | 4.199 | 3.950 | 299 | 0,08 meses |
| Panificadora Sol | 7891235 | 18,0% | 2.340 | 2.100 | 260 | 0,12 meses |
| Academia Movimento | 7891236 | 22,9% | 2.977 | 2.650 | 337 | 0,12 meses |
| Clínica Vida | 7891237 | 26,2% | 3.406 | 3.000 | 436 | 0,14 meses |
| **Total** | | **99,4%** | **12.922** | **11.700** | | |
| Não rateado | | 0,6% | 78 | — | — | — |

### billingSnapshot (Mercado Central — fixture regressivo)

| Campo | Valor |
|---|---|
| contaConcessionaria | R$ 453,09 |
| contaEsa | R$ 438,81 |
| economiaMensal | R$ 14,28 |
| economiaPercentual | 3,15% |
| economiaAnual | R$ 171,36 |
| invoiceAmount (ESA) | R$ 1.185,00 |

> `invoiceAmount` é a cobrança ESA pelo serviço de créditos, separada de `contaEsa` (valor pago à distribuidora).

### Faturas ESA

| Beneficiária | Valor | Status |
|---|---|---|
| Mercado Central | R$ 1.185,00 | Em aberto |
| Panificadora Sol | R$ 588,00 | Pago |
| Academia Movimento | R$ 768,50 | Em aberto |
| Clínica Vida | R$ 930,00 | Vencida |

> O status das faturas é mutável em memória: use os botões da tela Financeiro para testar confirmar/reabrir pagamento.

### Importações de faturas da concessionária

| ID | UC | Status | Observação |
|---|---|---|---|
| ubi-001 | 7891234 | matched | Vinculada a Mercado Central |
| ubi-002 | 9999999 | pending | UC desconhecida (sem correspondência) |
| ubi-003 | 7891234 | pending | Duplicata de ubi-001 (mesma UC+mês) |
| ubi-004 | 7891235 | confirmed | Processada (Panificadora Sol) |

### Alertas

| Tipo | Severidade | Entidade |
|---|---|---|
| LOW_BENEFICIARY_CREDIT_BALANCE | Alta | Mercado Central |
| CONSUMPTION_ABOVE_AVERAGE | Média | Mercado Central |
| ALLOCATION_PERCENTAGE_TOTAL_INVALID | Média | UG Solar Assaí |
| HIGH_BENEFICIARY_CREDIT_BALANCE | Baixa | Clínica Vida |

---

## Fontes tipográficas

O CSS da UI (`styles/energy-credits-app.css`) usa `DM Sans` e `DM Mono` como fontes primárias.
No preview isolado (sem `index.html` do dashboard legado), o browser cai no stack seguro:

- Corpo: `Inter, Arial, Helvetica, sans-serif`
- Mono: `'SFMono-Regular', Consolas, 'Liberation Mono', monospace`

Nenhum `@import` remoto existe no CSS do módulo.

---

## Globals de inspeção (DevTools)

```javascript
window.ecPreviewApp          // instância EnergyCreditsApp
window.ecPreviewProvider     // provider falso
window.ecPreviewNavigate('alerts')  // navegar programaticamente
```

---

## Restrições de segurança

- NÃO tocar em main
- NÃO publicar em produção
- NÃO alterar Firebase, Netlify ou index.html legado
- NÃO usar iframe
- Persistência: modo `preview` — nenhum dado é gravado
