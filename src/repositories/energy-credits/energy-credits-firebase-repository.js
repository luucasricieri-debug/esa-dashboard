/**
 * ESA OS — Repositories / Energy Credits
 * Stub Firebase — implementação futura.
 *
 * NENHUM método conecta ao Firebase real.
 * Todos lançam ENERGY_CREDITS_FIREBASE_REPOSITORY_NOT_IMPLEMENTED até que a
 * missão de persistência real seja executada.
 *
 * getStats() é o único método não-throwing — útil para diagnóstico.
 */

export const EC_FIREBASE_NOT_IMPLEMENTED = 'ENERGY_CREDITS_FIREBASE_REPOSITORY_NOT_IMPLEMENTED';

export class EnergyCreditsFirebaseRepository {

  constructor(firebaseClient = null) {
    this._client = firebaseClient;
  }

  _notImplemented(method) {
    throw new Error(
      `[EnergyCreditsFirebaseRepository.${method}] ${EC_FIREBASE_NOT_IMPLEMENTED} — ` +
      `será implementado em missão futura quando Firebase estiver pronto`,
    );
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  getSnapshot(options = {})                    { return this._notImplemented('getSnapshot'); }
  hydrateFromSnapshot(snapshot, options = {})  { return this._notImplemented('hydrateFromSnapshot'); }

  // ── Generating Units ──────────────────────────────────────────────────────

  saveGeneratingUnit(unit)           { return this._notImplemented('saveGeneratingUnit'); }
  getGeneratingUnit(id)              { return this._notImplemented('getGeneratingUnit'); }
  listGeneratingUnits(filters = {})  { return this._notImplemented('listGeneratingUnits'); }

  // ── Beneficiary Units ─────────────────────────────────────────────────────

  saveBeneficiaryUnit(unit)           { return this._notImplemented('saveBeneficiaryUnit'); }
  getBeneficiaryUnit(id)              { return this._notImplemented('getBeneficiaryUnit'); }
  listBeneficiaryUnits(filters = {})  { return this._notImplemented('listBeneficiaryUnits'); }

  // ── Generating Unit Monthly Records ───────────────────────────────────────

  saveGeneratingUnitMonthlyRecord(record)         { return this._notImplemented('saveGeneratingUnitMonthlyRecord'); }
  getGeneratingUnitMonthlyRecord(id)              { return this._notImplemented('getGeneratingUnitMonthlyRecord'); }
  listGeneratingUnitMonthlyRecords(filters = {})  { return this._notImplemented('listGeneratingUnitMonthlyRecords'); }

  // ── Beneficiary Monthly Records ───────────────────────────────────────────

  saveBeneficiaryMonthlyRecord(record)         { return this._notImplemented('saveBeneficiaryMonthlyRecord'); }
  getBeneficiaryMonthlyRecord(id)              { return this._notImplemented('getBeneficiaryMonthlyRecord'); }
  listBeneficiaryMonthlyRecords(filters = {})  { return this._notImplemented('listBeneficiaryMonthlyRecords'); }

  // ── Credit Allocations ────────────────────────────────────────────────────

  saveCreditAllocation(alloc)          { return this._notImplemented('saveCreditAllocation'); }
  getCreditAllocation(id)              { return this._notImplemented('getCreditAllocation'); }
  listCreditAllocations(filters = {})  { return this._notImplemented('listCreditAllocations'); }

  // ── Owner Settlements ─────────────────────────────────────────────────────

  saveOwnerSettlement(settlement)       { return this._notImplemented('saveOwnerSettlement'); }
  getOwnerSettlement(id)                { return this._notImplemented('getOwnerSettlement'); }
  listOwnerSettlements(filters = {})    { return this._notImplemented('listOwnerSettlements'); }

  // ── ESA Invoices ──────────────────────────────────────────────────────────

  saveEsaInvoice(invoice)          { return this._notImplemented('saveEsaInvoice'); }
  getEsaInvoice(id)                { return this._notImplemented('getEsaInvoice'); }
  listEsaInvoices(filters = {})    { return this._notImplemented('listEsaInvoices'); }

  // ── Monthly Reports ───────────────────────────────────────────────────────

  saveMonthlyReport(report)          { return this._notImplemented('saveMonthlyReport'); }
  getMonthlyReport(id)               { return this._notImplemented('getMonthlyReport'); }
  listMonthlyReports(filters = {})   { return this._notImplemented('listMonthlyReports'); }

  // ── Credit Documents ──────────────────────────────────────────────────────

  saveCreditDocument(doc)            { return this._notImplemented('saveCreditDocument'); }
  getCreditDocument(id)              { return this._notImplemented('getCreditDocument'); }
  listCreditDocuments(filters = {})  { return this._notImplemented('listCreditDocuments'); }

  // ── Credit Audit Log ──────────────────────────────────────────────────────

  appendCreditAuditLog(entry)        { return this._notImplemented('appendCreditAuditLog'); }
  listCreditAuditLog(filters = {})   { return this._notImplemented('listCreditAuditLog'); }

  // ── Stats (não-throwing — diagnóstico) ────────────────────────────────────

  getStats() {
    return {
      type:        'firebase-stub',
      initialized: !!this._client,
      note:        EC_FIREBASE_NOT_IMPLEMENTED,
    };
  }
}
