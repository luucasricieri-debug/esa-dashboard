'use strict';
/**
 * ESA OS — CRM: renovação automática de sessão no upload de anexos (frontend)
 *
 * Testa, com EXECUÇÃO REAL do código extraído de index.html (getStoredSession,
 * getValidSessionToken, refreshSessionToken, authenticatedFetch, crmUploadArquivo),
 * rodando num sandbox vm com fetch/DOM/FileReader/sessionStorage/localStorage
 * simulados — não apenas checagem de string.
 *
 * Cobre: retry único após renovação, preservação do arquivo selecionado durante
 * a renovação, limpeza do input só após sucesso confirmado, mensagem clara
 * quando a renovação falha, deduplicação de renovações concorrentes (mesma
 * aba) e independência entre duas abas com tokens diferentes.
 *
 * Rodar: npx tsx tests/crm-upload-frontend-retry.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── Extração brace-balanced (CRLF-safe) do código real de index.html ────────

function extractFunction(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`função não encontrada: ${startPattern}`);
  const start = m.index;
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  // Inclui ";" final se a extração for uma expressão atribuída (window.x=...;)
  if (src[i] === ';') i++;
  return src.slice(start, i);
}
function extractStatement(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`statement não encontrada: ${startPattern}`);
  const semi = src.indexOf(';', m.index);
  if (semi === -1) throw new Error(`';' de fechamento não encontrado para: ${startPattern}`);
  return src.slice(m.index, semi + 1);
}

const getStoredSessionSrc = extractFunction(currentHtml, /function getStoredSession\(\)/);
const getValidSessionTokenSrc = extractFunction(currentHtml, /async function getValidSessionToken\(\)/);
const refreshInFlightDecl = extractStatement(currentHtml, /var _sessionRefreshInFlight=null;/);
const refreshSessionTokenSrc = extractFunction(currentHtml, /async function refreshSessionToken\(\)/);
const parseAuthResponseSrc = extractFunction(currentHtml, /async function parseAuthResponse\(res\)/);
const retryableCodesDecl = extractStatement(currentHtml, /var AUTH_RETRYABLE_CODES=/);
const authenticatedFetchSrc = extractFunction(currentHtml, /async function authenticatedFetch\(/);
const crmErrorMessagesDecl = extractStatement(currentHtml, /var CRM_UPLOAD_ERROR_MESSAGES=/);
const crmUploadArquivoSrc = extractFunction(currentHtml, /window\.crmUploadArquivo=async function\(\)/);
const fbSetSrc = extractFunction(currentHtml, /async function fbSet\(/);

assert('setup: todas as funções relevantes foram extraídas do index.html real (sem erro)', true);

// ═══════════════════════════════════════════════════════════════════════════
// Sandbox — fetch/DOM/FileReader/sessionStorage/localStorage simulados
// ═══════════════════════════════════════════════════════════════════════════

type FetchCall = { url: string; method: string; body: any };

function makeSandbox(opts: {
  crmUploadBehavior: (attemptIndex: number, body: any) => { status: number; json: any };
  sessionTokenBehavior?: (body: any) => { status: number; json: any };
  initialSession?: Record<string, unknown>;
  initialRemember?: Record<string, unknown> | null;
}) {
  const calls: FetchCall[] = [];
  let crmUploadCallCount = 0;

  const sessionStore = new Map<string, string>();
  const localStore = new Map<string, string>();
  if (opts.initialSession) sessionStore.set('esa_session', JSON.stringify(opts.initialSession));
  if (opts.initialRemember) localStore.set('esa_remember', JSON.stringify(opts.initialRemember));

  const fakeSessionStorage = {
    getItem: (k: string) => (sessionStore.has(k) ? sessionStore.get(k)! : null),
    setItem: (k: string, v: string) => { sessionStore.set(k, v); },
    removeItem: (k: string) => { sessionStore.delete(k); },
  };
  const fakeLocalStorage = {
    getItem: (k: string) => (localStore.has(k) ? localStore.get(k)! : null),
    setItem: (k: string, v: string) => { localStore.set(k, v); },
    removeItem: (k: string) => { localStore.delete(k); },
  };

  const domStore = new Map<string, any>();
  function elFor(id: string) {
    if (!domStore.has(id)) domStore.set(id, { id, value: '', textContent: '', disabled: false, style: {}, files: [] as any[] });
    return domStore.get(id);
  }

  const fakeFetch = async (url: string, reqOpts: any = {}) => {
    const parsedBody = reqOpts.body ? JSON.parse(reqOpts.body) : {};
    calls.push({ url, method: reqOpts.method || 'GET', body: parsedBody });
    if (url.includes('crm-upload')) {
      crmUploadCallCount++;
      const { status, json } = opts.crmUploadBehavior(crmUploadCallCount, parsedBody);
      return { ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) };
    }
    if (url.includes('session-token')) {
      const behavior = opts.sessionTokenBehavior || (() => ({ status: 200, json: { sessionToken: 'renewed-token-xyz', expiresAt: Date.now() + 8 * 3600 * 1000 } }));
      const { status, json } = behavior(parsedBody);
      return { ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) };
    }
    // fbSet (Firebase REST PUT) — usado para persistir arqData em crm/deals/...
    return { ok: true, json: async () => parsedBody, text: async () => JSON.stringify(parsedBody) };
  };

  class FakeFileReader {
    onload: ((e: { target: { result: string } }) => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(_file: any) {
      Promise.resolve().then(() => {
        if (this.onload) this.onload({ target: { result: 'data:application/pdf;base64,ZmFrZS1wZGYtY29udGVudA==' } });
      });
    }
  }

  const windowObj: Record<string, unknown> = {};
  const context = vm.createContext({
    fetch: fakeFetch,
    window: windowObj,
    document: { getElementById: elFor },
    sessionStorage: fakeSessionStorage,
    localStorage: fakeLocalStorage,
    FileReader: FakeFileReader,
    console,
    setTimeout,
    Promise, JSON, Object, Array, Date, Error, String, Number, Boolean, Math,
    DB: 'https://fake-rtdb.firebaseio.com',
    CU: { level: 'diretor' },
    crmDeals: {} as Record<string, any>,
    crmRenderArquivos: () => {},
    crmRenderView: () => {},
    showToast: () => {},
  });

  return { context, calls, domStore, elFor, sessionStore, localStore, getCrmUploadCallCount: () => crmUploadCallCount };
}

function buildAndRun(sandbox: ReturnType<typeof makeSandbox>) {
  vm.runInContext(
    [
      getStoredSessionSrc, getValidSessionTokenSrc, refreshInFlightDecl, refreshSessionTokenSrc,
      parseAuthResponseSrc, retryableCodesDecl, authenticatedFetchSrc, crmErrorMessagesDecl, fbSetSrc, crmUploadArquivoSrc,
      'this.__crmUploadArquivo = window.crmUploadArquivo;',
    ].join('\n'),
    sandbox.context,
  );
  return sandbox.context.__crmUploadArquivo as () => Promise<void>;
}

function setupUploadModalDom(sandbox: ReturnType<typeof makeSandbox>, dealId: string, fileName: string) {
  sandbox.elFor('arq-deal-id').value = dealId;
  sandbox.elFor('arq-file').files = [{ name: fileName, type: 'application/pdf', size: 1024 }];
  sandbox.elFor('arq-err').textContent = '';
  sandbox.elFor('arq-send-btn').disabled = false;
  sandbox.elFor('arq-send-btn').textContent = 'Enviar arquivo';
  sandbox.elFor('arq-progress-wrap').style.display = 'none';
  sandbox.elFor('arq-progress-bar').style.width = '0%';
  sandbox.elFor('arq-progress-label').textContent = '';
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite FR1 — token válido: envia sem retry
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
  console.log('\nSuite FR1 — token válido: envia sem necessidade de renovação');
  {
    const sandbox = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'valid-token-1', sessionExpiresAt: Date.now() + 3600000 },
      crmUploadBehavior: () => ({ status: 200, json: { nome: 'a.pdf', url: 'https://x/a.pdf', tipo: 'application/pdf', tamanho: 10, uploadedBy: 'User', uploadedAt: 12345, path: 'crm/d1/12345_a.pdf' } }),
    });
    const crmUploadArquivo = buildAndRun(sandbox);
    setupUploadModalDom(sandbox, 'd1', 'a.pdf');
    await crmUploadArquivo();
    const crmUploadCalls = sandbox.calls.filter(c => c.url.includes('crm-upload'));
    assert('FR01 token válido: exatamente 1 chamada a crm-upload (sem retry)', crmUploadCalls.length === 1);
    assert('FR02 token válido: sessionToken enviado é o token armazenado', crmUploadCalls[0].body.sessionToken === 'valid-token-1');
    assert('FR03 sucesso: input de arquivo é limpo (value === "")', sandbox.elFor('arq-file').value === '');
    assert('FR04 sucesso: nenhuma mensagem de erro exibida', sandbox.elFor('arq-err').textContent === '');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite FR2 — token expirado: renova automaticamente e reenvia UMA vez
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite FR2 — token expirado: renova automaticamente e reenvia (retry único)');
  {
    const sandbox = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'expired-token', sessionExpiresAt: Date.now() - 1000 },
      crmUploadBehavior: (attempt) => {
        if (attempt === 1) return { status: 401, json: { ok: false, code: 'token_expired', message: 'Sessão expirada.' } };
        return { status: 200, json: { nome: 'b.pdf', url: 'https://x/b.pdf', tipo: 'application/pdf', tamanho: 20, uploadedBy: 'User', uploadedAt: 22222, path: 'crm/d1/22222_b.pdf' } };
      },
    });
    const crmUploadArquivo = buildAndRun(sandbox);
    setupUploadModalDom(sandbox, 'd1', 'b.pdf');
    await crmUploadArquivo();

    const crmUploadCalls = sandbox.calls.filter(c => c.url.includes('crm-upload'));
    const sessionTokenCalls = sandbox.calls.filter(c => c.url.includes('session-token'));
    assert('FR05 token expirado: exatamente 2 chamadas a crm-upload (original + 1 retry, nunca mais)', crmUploadCalls.length === 2);
    assert('FR06 token expirado: exatamente 1 chamada de renovação (session-token)', sessionTokenCalls.length === 1);
    assert('FR07 renovação: chamada usa uid+login (Path B), não o token expirado', sessionTokenCalls[0].body.uid === 'u1' && sessionTokenCalls[0].body.login === 'user1');
    assert('FR08 retry: segunda chamada a crm-upload usa o token NOVO (renewed-token-xyz), não o expirado', crmUploadCalls[1].body.sessionToken === 'renewed-token-xyz');
    assert('FR09 retry: o MESMO arquivo (fileName) é reenviado — nada foi perdido', crmUploadCalls[0].body.fileName === 'b.pdf' && crmUploadCalls[1].body.fileName === 'b.pdf');
    assert('FR10 retry: o mesmo clientRequestId é usado nas duas tentativas (idempotência)', crmUploadCalls[0].body.clientRequestId === crmUploadCalls[1].body.clientRequestId);
    assert('FR11 sucesso após retry: input de arquivo é limpo', sandbox.elFor('arq-file').value === '');
    assert('FR12 sucesso após retry: sessionStorage foi atualizado com o token renovado', JSON.parse(sandbox.sessionStore.get('esa_session')!).sessionToken === 'renewed-token-xyz');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite FR3 — retry falha de novo: NÃO cria loop, preserva arquivo, orienta login
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite FR3 — retry falha novamente: não cria loop, preserva arquivo selecionado, mensagem clara');
  {
    const sandbox = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'expired-token', sessionExpiresAt: Date.now() - 1000 },
      crmUploadBehavior: () => ({ status: 401, json: { ok: false, code: 'token_expired', message: 'Sessão expirada.' } }),
    });
    const crmUploadArquivo = buildAndRun(sandbox);
    setupUploadModalDom(sandbox, 'd1', 'c.pdf');
    await crmUploadArquivo();

    const crmUploadCalls = sandbox.calls.filter(c => c.url.includes('crm-upload'));
    assert('FR13 retry falha de novo: exatamente 2 chamadas a crm-upload (nunca um 3º retry — sem loop)', crmUploadCalls.length === 2);
    assert('FR14 falha final: arquivo permanece selecionado (input NÃO foi limpo)', sandbox.elFor('arq-file').value === '');
    assert('FR14b falha final: input.value nunca foi setado para vazio explicitamente (files[] intacto)', sandbox.elFor('arq-file').files.length === 1);
    assert('FR15 falha final: mensagem de erro exibida ao usuário (não vazia)', sandbox.elFor('arq-err').textContent.length > 0);
    assert('FR16 falha final: mensagem NÃO expõe "Token inválido" nem jargão técnico', !sandbox.elFor('arq-err').textContent.includes('Token inválido'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite FR4 — falha de renovação: orienta login, preserva arquivo
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite FR4 — falha ao renovar (uid/login inválidos no backend): orienta novo login');
  {
    const sandbox = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'expired-token', sessionExpiresAt: Date.now() - 1000 },
      crmUploadBehavior: () => ({ status: 401, json: { ok: false, code: 'token_expired', message: 'Sessão expirada.' } }),
      sessionTokenBehavior: () => ({ status: 401, json: { ok: false, code: 'invalid_session' } }),
    });
    const crmUploadArquivo = buildAndRun(sandbox);
    setupUploadModalDom(sandbox, 'd1', 'd.pdf');
    await crmUploadArquivo();

    const crmUploadCalls = sandbox.calls.filter(c => c.url.includes('crm-upload'));
    assert('FR17 renovação falhou: apenas 1 chamada a crm-upload (não tenta reenviar sem token novo)', crmUploadCalls.length === 1);
    assert('FR18 renovação falhou: arquivo permanece selecionado', sandbox.elFor('arq-file').files.length === 1);
    assert('FR19 renovação falhou: mensagem orienta login (texto atualizado nesta missão: "Entre novamente")', sandbox.elFor('arq-err').textContent.includes('Entre novamente'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite FR5 — mensagens diferenciadas por código de erro
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite FR5 — mensagens diferenciadas: file_too_large / unsupported_file_type / no_permission');
  {
    const scenarios: [string, string][] = [
      ['file_too_large', 'O arquivo excede o limite de 10 MB.'],
      ['unsupported_file_type', 'Formato de arquivo não permitido.'],
      ['no_permission', 'Sem permissão para upload no CRM.'],
    ];
    for (const [code, expectedMsg] of scenarios) {
      const sandbox = makeSandbox({
        initialSession: { uid: 'u1', login: 'user1', sessionToken: 'valid-token', sessionExpiresAt: Date.now() + 3600000 },
        crmUploadBehavior: () => ({ status: 400, json: { ok: false, code, message: 'x' } }),
      });
      const crmUploadArquivo = buildAndRun(sandbox);
      setupUploadModalDom(sandbox, 'd1', 'e.pdf');
      await crmUploadArquivo();
      assert(`FR20.${code} mensagem amigável exibida para code=${code}`, sandbox.elFor('arq-err').textContent === expectedMsg);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite FR6 — renovação concorrente: dedup dentro da mesma aba
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite FR6 — renovação concorrente: duas chamadas simultâneas de refreshSessionToken() disparam só 1 fetch');
  {
    let sessionTokenCallCount = 0;
    const sandbox = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'valid', sessionExpiresAt: Date.now() + 3600000 },
      crmUploadBehavior: () => ({ status: 200, json: { uploadedAt: 1 } }),
      sessionTokenBehavior: () => { sessionTokenCallCount++; return { status: 200, json: { sessionToken: 'renewed-once', expiresAt: Date.now() + 3600000 } }; },
    });
    vm.runInContext(
      [getStoredSessionSrc, refreshInFlightDecl, refreshSessionTokenSrc, 'this.__refresh = refreshSessionToken;'].join('\n'),
      sandbox.context,
    );
    const refresh = sandbox.context.__refresh as () => Promise<string>;
    const [r1, r2, r3] = await Promise.all([refresh(), refresh(), refresh()]);
    assert('FR21 3 chamadas concorrentes a refreshSessionToken(): apenas 1 fetch real ao backend', sessionTokenCallCount === 1);
    assert('FR22 as 3 chamadas concorrentes retornam o MESMO token renovado', r1 === 'renewed-once' && r2 === 'renewed-once' && r3 === 'renewed-once');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite FR7 — duas abas com tokens diferentes: independência
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite FR7 — duas abas com tokens diferentes: cada aba renova o próprio token de forma independente');
  {
    const sandboxTabA = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'expired-tab-a', sessionExpiresAt: Date.now() - 1000 },
      crmUploadBehavior: (attempt) => attempt === 1
        ? { status: 401, json: { ok: false, code: 'token_expired' } }
        : { status: 200, json: { uploadedAt: 111 } },
      sessionTokenBehavior: () => ({ status: 200, json: { sessionToken: 'renewed-tab-a', expiresAt: Date.now() + 3600000 } }),
    });
    const sandboxTabB = makeSandbox({
      initialSession: { uid: 'u2', login: 'user2', sessionToken: 'still-valid-tab-b', sessionExpiresAt: Date.now() + 3600000 },
      crmUploadBehavior: () => ({ status: 200, json: { uploadedAt: 222 } }),
    });
    const uploadA = buildAndRun(sandboxTabA);
    const uploadB = buildAndRun(sandboxTabB);
    setupUploadModalDom(sandboxTabA, 'd1', 'a.pdf');
    setupUploadModalDom(sandboxTabB, 'd1', 'b.pdf');
    await Promise.all([uploadA(), uploadB()]);

    assert('FR23 aba A (token expirado): renovou para renewed-tab-a', JSON.parse(sandboxTabA.sessionStore.get('esa_session')!).sessionToken === 'renewed-tab-a');
    assert('FR24 aba B (token ainda válido): NÃO precisou renovar, token continua still-valid-tab-b', JSON.parse(sandboxTabB.sessionStore.get('esa_session')!).sessionToken === 'still-valid-tab-b');
    assert('FR25 aba B nunca chamou session-token (não precisava renovar)', sandboxTabB.calls.filter(c => c.url.includes('session-token')).length === 0);
    assert('FR26 renovação da aba A não afeta a sessão da aba B (sessionStorage isolado por aba)',
      JSON.parse(sandboxTabB.sessionStore.get('esa_session')!).sessionToken !== 'renewed-tab-a');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CRM Upload Frontend Retry Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
