/**
 * ESA OS — Importers / Energy Credits
 * EnergyCreditsCsvTemplateService
 *
 * Gera templates CSV para importação de créditos ESA Energia.
 * Headers baseados nos aliases reais do EnergyCreditsImportMapper.
 * Delimiter padrão: ";" (compatível com autodetect do CsvParser).
 */

const DELIMITER = ';';

const TEMPLATES = {
  'generating-units': {
    headers: ['id', 'name', 'ownerName', 'ownerDocument', 'uc', 'utilityCompany', 'status'],
    exampleRows: [
      ['gu-001', 'Usina Solar Norte', 'João Silva', '123.456.789-00', 'UC001', 'COPEL', 'active'],
    ],
    aliases: {
      id:             ['id', 'codigo', 'código'],
      name:           ['name', 'nome'],
      ownerName:      ['ownerName', 'proprietario', 'proprietário', 'dono'],
      ownerDocument:  ['ownerDocument', 'cpfCnpj', 'cpf_cnpj', 'documento'],
      uc:             ['uc', 'unidadeConsumidora', 'unidade_consumidora'],
      utilityCompany: ['utilityCompany', 'distribuidora', 'concessionaria', 'concessionária'],
      status:         ['status'],
    },
  },
  'beneficiary-units': {
    headers: ['id', 'generatingUnitId', 'name', 'document', 'uc', 'utilityCompany', 'status'],
    exampleRows: [
      ['ub-001', 'gu-001', 'Maria Santos', '987.654.321-00', 'UC002', 'COPEL', 'active'],
    ],
    aliases: {
      id:               ['id', 'codigo', 'código'],
      generatingUnitId: ['generatingUnitId', 'unidadeGeradoraId', 'unidade_geradora_id', 'ugId'],
      name:             ['name', 'nome'],
      document:         ['document', 'cpfCnpj', 'cpf_cnpj', 'documento'],
      uc:               ['uc', 'unidadeConsumidora', 'unidade_consumidora'],
      utilityCompany:   ['utilityCompany', 'distribuidora', 'concessionaria', 'concessionária'],
      status:           ['status'],
    },
  },
  'generating-unit-monthly-records': {
    headers: ['id', 'generatingUnitId', 'referenceMonth', 'previousBalanceKwh', 'monthlyGenerationKwh', 'purchasePricePerKwh', 'status'],
    exampleRows: [
      ['gum-001-2025-06', 'gu-001', '2025-06', '500', '4500', '0.40', 'active'],
    ],
    aliases: {
      id:                   ['id', 'codigo', 'código'],
      generatingUnitId:     ['generatingUnitId', 'unidadeGeradoraId', 'unidade_geradora_id', 'ugId'],
      referenceMonth:       ['referenceMonth', 'mesReferencia', 'mêsReferência', 'mes_referencia'],
      previousBalanceKwh:   ['previousBalanceKwh', 'saldoAnteriorKwh', 'saldo_anterior_kwh'],
      monthlyGenerationKwh: ['monthlyGenerationKwh', 'geracaoMensalKwh', 'geraçãoMensalKwh', 'geracao_mensal_kwh'],
      purchasePricePerKwh:  ['purchasePricePerKwh', 'precoCompraKwh', 'preçoCompraKwh', 'preco_compra_kwh'],
      status:               ['status'],
    },
  },
  'beneficiary-monthly-records': {
    headers: [
      'id', 'beneficiaryUnitId', 'generatingUnitId', 'referenceMonth',
      'monthlyConsumptionKwh', 'allocatedKwh', 'compensatedKwh',
      'esaPricePerKwh', 'utilityTariffPerKwh', 'paymentStatus', 'status',
    ],
    exampleRows: [[
      'ubm-001-2025-06', 'ub-001', 'gu-001', '2025-06',
      '350', '350', '320',
      '0.35', '0.75', 'pending', 'active',
    ]],
    aliases: {
      id:                    ['id', 'codigo', 'código'],
      beneficiaryUnitId:     ['beneficiaryUnitId', 'unidadeBeneficiariaId', 'unidade_beneficiaria_id', 'ubId'],
      generatingUnitId:      ['generatingUnitId', 'unidadeGeradoraId', 'unidade_geradora_id', 'ugId'],
      referenceMonth:        ['referenceMonth', 'mesReferencia', 'mêsReferência', 'mes_referencia'],
      monthlyConsumptionKwh: ['monthlyConsumptionKwh', 'consumoMensalKwh', 'consumo_mensal_kwh'],
      allocatedKwh:          ['allocatedKwh', 'creditosAlocadosKwh', 'créditosAlocadosKwh', 'creditos_alocados_kwh'],
      compensatedKwh:        ['compensatedKwh', 'creditosCompensadosKwh', 'créditosCompensadosKwh', 'creditos_compensados_kwh'],
      esaPricePerKwh:        ['esaPricePerKwh', 'precoEsaKwh', 'preçoEsaKwh', 'preco_esa_kwh'],
      utilityTariffPerKwh:   ['utilityTariffPerKwh', 'tarifaDistribuidoraKwh', 'tarifa_distribuidora_kwh'],
      paymentStatus:         ['paymentStatus', 'statusPagamento', 'status_pagamento'],
      status:                ['status'],
    },
  },
};

const UNKNOWN_TYPE_ERROR = (importType) => ({
  code:     'UNKNOWN_IMPORT_TYPE',
  message:  `Tipo de importação desconhecido: ${importType}. Tipos válidos: ${Object.keys(TEMPLATES).join(', ')}`,
  field:    'importType',
  metadata: {},
});

function _buildCsvText(def, delimiter) {
  const lines = [
    def.headers.join(delimiter),
    ...def.exampleRows.map(row => row.join(delimiter)),
    '',
  ];
  return lines.join('\n');
}

export class EnergyCreditsCsvTemplateService {

  getTemplate(importType, options = {}) {
    const def = TEMPLATES[importType];
    if (!def) {
      return { ok: false, data: null, errors: [UNKNOWN_TYPE_ERROR(importType)], warnings: [], metadata: {} };
    }

    const delimiter = options.delimiter || DELIMITER;
    const csvText   = _buildCsvText(def, delimiter);

    return {
      ok: true,
      data: {
        importType,
        delimiter,
        headers:     def.headers,
        exampleRows: def.exampleRows,
        csvText,
        aliases:     def.aliases,
      },
      errors:   [],
      warnings: [],
      metadata: { importType, delimiter, headerCount: def.headers.length },
    };
  }

  getSupportedTypes() {
    return Object.keys(TEMPLATES);
  }

}

export const energyCreditsCsvTemplateService = new EnergyCreditsCsvTemplateService();
