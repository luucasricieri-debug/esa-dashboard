/**
 * ESA OS — Queries / CRM
 * CRMQueryResult
 *
 * Envelope padrão para todas as respostas do CRMQueryService.
 * Garante estrutura consistente para UI, Solana IA, APIs e relatórios.
 *
 * IMPORTANTE:
 * toJSON() retorna snapshots rasos — não expõe referências internas mutáveis.
 * Não implementa deep clone: use para esta Sprint clone raso (Object.assign / slice).
 */

export class CRMQueryResult {
  /**
   * @param {*}      data          - Dado principal da consulta
   * @param {Object} [metadata={}] - Metadados descritivos da consulta
   */
  constructor(data, metadata = {}) {
    this.data        = data;
    this.metadata    = metadata;
    this.generatedAt = Date.now();
  }

  /**
   * Retorna snapshot serializado da resposta.
   * Arrays retornam novo array. Objetos retornam clone raso.
   * Não expõe referências internas mutáveis.
   *
   * @returns {{ data: *, metadata: Object, generatedAt: number }}
   */
  toJSON() {
    let data;

    if (Array.isArray(this.data)) {
      data = this.data.slice();
    } else if (this.data !== null && typeof this.data === 'object') {
      data = Object.assign({}, this.data);
    } else {
      data = this.data;
    }

    return {
      data,
      metadata:    Object.assign({}, this.metadata),
      generatedAt: this.generatedAt,
    };
  }
}
