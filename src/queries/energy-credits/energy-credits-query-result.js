/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsQueryResult
 *
 * Envelope de resposta para queries de créditos.
 * generatedAt vem do options.referenceDate, nunca de Date.now().
 */

export class EnergyCreditsQueryResult {

  constructor(data, metadata = {}, referenceDate = null) {
    this.data        = data;
    this.metadata    = metadata;
    this.generatedAt = referenceDate !== null && referenceDate !== undefined ? referenceDate : null;
  }

  toJSON() {
    let data;
    if (Array.isArray(this.data)) {
      data = this.data.slice();
    } else if (this.data !== null && this.data !== undefined && typeof this.data === 'object') {
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
