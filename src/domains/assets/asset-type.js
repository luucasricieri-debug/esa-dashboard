/**
 * ESA OS — Assets Domain
 * AssetType
 *
 * Catálogo de tipos de ativo energético.
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado. Sem Firebase.
 */

export const ASSET_TYPE = {
  SOLAR_PLANT:      'SOLAR_PLANT',      // Usina fotovoltaica
  BATTERY_SYSTEM:   'BATTERY_SYSTEM',   // Sistema de bateria
  EV_CHARGER:       'EV_CHARGER',       // Estação de recarga
  TRANSFORMER:      'TRANSFORMER',      // Transformador
  SUBSTATION:       'SUBSTATION',       // Subestação
  METER:            'METER',            // Medidor de energia
  ELECTRICAL_PANEL: 'ELECTRICAL_PANEL', // Quadro elétrico
  GENERATOR:        'GENERATOR',        // Gerador
  OTHER:            'OTHER',
};

export const ASSET_TYPE_LABEL = {
  [ASSET_TYPE.SOLAR_PLANT]:      'Usina Fotovoltaica',
  [ASSET_TYPE.BATTERY_SYSTEM]:   'Sistema de Bateria',
  [ASSET_TYPE.EV_CHARGER]:       'Estação de Recarga',
  [ASSET_TYPE.TRANSFORMER]:      'Transformador',
  [ASSET_TYPE.SUBSTATION]:       'Subestação',
  [ASSET_TYPE.METER]:            'Medidor',
  [ASSET_TYPE.ELECTRICAL_PANEL]: 'Quadro Elétrico',
  [ASSET_TYPE.GENERATOR]:        'Gerador',
  [ASSET_TYPE.OTHER]:            'Outro',
};
