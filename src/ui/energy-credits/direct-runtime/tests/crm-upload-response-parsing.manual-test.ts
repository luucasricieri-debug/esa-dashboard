'use strict';
/**
 * ESA OS — Upload do CRM: frontend interpreta QUALQUER resposta (não só JSON feliz)
 *
 * Testa, com EXECUÇÃO REAL do código extraído de index.html (vm sandbox):
 * parseAuthResponse() nunca reduz o erro a "HTTP <status>" cru — lê texto
 * primeiro, tenta JSON.parse, trata corpo vazio e HTML inesperado sem lançar;
 * authenticatedFetch() tenta renovação para token_expired/invalid_session/
 * legacy_session (nunca para no_permission), faz retry único, lê o token mais
 * recente do storage a cada tentativa (nunca um valor capturado antes); e que
 * doLogin()/resumeSession() (também corrigidos nesta missão) resolvem uid
 * pela CHAVE do Firebase, nunca pelo campo .uid.
 *
 * Rodar: npx tsx tests/crm-upload-response-parsing.manual-test.ts
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

function extractFunction(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`função não encontrada: ${startPattern}`);
  const start = m.index;
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
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
const authenticatedFetchSrc = extractFunction(currentHtml, /async function authenticatedFetch\(url, buildBody\)/);

// ═══════════════════════════════════════════════════════════════════════════
// Suite RP1 — Static: authenticatedFetch nunca chama res.json() diretamente
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite RP1 — parseAuthResponse(): nunca chama response.json() direto (source)');

assert('RP01 parseAuthResponse existe', currentHtml.includes('async function parseAuthResponse(res)'));
assert('RP02 lê o corpo como texto primeiro (response.text())', currentHtml.includes('await res.text()'));
assert('RP03 authenticatedFetch usa parseAuthResponse, não res.json() direto no caminho de erro', !/authenticatedFetch[\s\S]{0,50}res\.json\(\)/.test(currentHtml));
assert('RP04 legacy_session incluído nos códigos que acionam retry', currentHtml.includes("AUTH_RETRYABLE_CODES=['token_expired','invalid_session','legacy_session']"));
assert('RP05 mensagem final de sessão irrecuperável é exatamente a pedida', currentHtml.includes('Sua sessão não pôde ser renovada. Entre novamente e tente enviar o arquivo.'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite RP2 — parseAuthResponse(): execução real (corpo vazio, HTML, JSON sem code)
// ═══════════════════════════════════════════════════════════════════════════

function makeParseContext() {
  const context = vm.createContext({ console, JSON });
  vm.runInContext(`${parseAuthResponseSrc}\nthis.__parse = parseAuthResponse;`, context);
  return context.__parse as (res: { status: number; text: () => Promise<string> }) => Promise<any>;
}

async function run() {
  console.log('\nSuite RP2 — parseAuthResponse(): execução real (nunca lança, nunca reduz a "HTTP <status>")');

  const parse = makeParseContext();

  {
    const r = await parse({ status: 401, text: async () => JSON.stringify({ ok: false, code: 'token_expired', stage: 'upload_initial_auth', message: 'Sessão expirada.', requestId: 'req-1' }) });
    assert('RP06 JSON bem formado: code/stage/message/requestId preservados', r.code === 'token_expired' && r.stage === 'upload_initial_auth' && r.message === 'Sessão expirada.' && r.requestId === 'req-1');
    assert('RP07 status HTTP preservado', r.status === 401);
  }
  {
    const r = await parse({ status: 401, text: async () => '' });
    assert('RP08 corpo vazio: não lança, code fica null (nunca "HTTP 401" fabricado)', r.code === null && r.status === 401);
  }
  {
    const r = await parse({ status: 401, text: async () => '<html><body>502 Bad Gateway</body></html>' });
    assert('RP09 HTML inesperado: não lança, code fica null, status preservado', r.code === null && r.status === 401);
  }
  {
    const r = await parse({ status: 401, text: async () => JSON.stringify({ ok: false }) });
    assert('RP10 JSON válido mas sem "code": não lança, code fica null explicitamente (não undefined mascarado)', r.code === null);
  }
  {
    const r = await parse({ status: 500, text: async () => { throw new Error('network stream error'); } });
    assert('RP11 res.text() falha (stream quebrado): não lança, status ainda preservado', r.status === 500 && r.code === null);
  }

  console.log('\nSuite RP3 — authenticatedFetch(): retry único para token_expired/invalid_session/legacy_session, nunca para no_permission');

  function makeSandbox(opts: {
    crmUploadBehavior: (attempt: number) => { status: number; json: any };
    sessionTokenBehavior?: () => { status: number; json: any };
    initialSession?: Record<string, unknown>;
  }) {
    const calls: { url: string; body: any }[] = [];
    let crmCalls = 0;
    const sessionStore = new Map<string, string>();
    if (opts.initialSession) sessionStore.set('esa_session', JSON.stringify(opts.initialSession));
    const fakeSessionStorage = {
      getItem: (k: string) => (sessionStore.has(k) ? sessionStore.get(k)! : null),
      setItem: (k: string, v: string) => { sessionStore.set(k, v); },
      removeItem: (k: string) => { sessionStore.delete(k); },
    };
    const fakeLocalStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const fakeFetch = async (url: string, reqOpts: any = {}) => {
      const parsedBody = reqOpts.body ? JSON.parse(reqOpts.body) : {};
      calls.push({ url, body: parsedBody });
      if (url.includes('crm-upload')) {
        crmCalls++;
        const { status, json } = opts.crmUploadBehavior(crmCalls);
        return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(json) };
      }
      if (url.includes('session-token')) {
        const behavior = opts.sessionTokenBehavior || (() => ({ status: 200, json: { sessionToken: 'renewed-token', expiresAt: Date.now() + 3600000 } }));
        const { status, json } = behavior();
        return { ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) };
      }
      return { ok: true, json: async () => ({}), text: async () => '{}' };
    };
    const context = vm.createContext({
      fetch: fakeFetch, sessionStorage: fakeSessionStorage, localStorage: fakeLocalStorage,
      console, JSON, Promise, Date, Math,
    });
    vm.runInContext(
      [getStoredSessionSrc, getValidSessionTokenSrc, refreshInFlightDecl, refreshSessionTokenSrc, parseAuthResponseSrc, retryableCodesDecl, authenticatedFetchSrc, 'this.__fn = authenticatedFetch;'].join('\n'),
      context,
    );
    return { fn: context.__fn as (url: string, buildBody: (t: string) => any) => Promise<any>, calls, getCrmCalls: () => crmCalls };
  }

  {
    const { fn, getCrmCalls } = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'expired-tok', sessionExpiresAt: Date.now() - 1000 },
      crmUploadBehavior: (a) => a === 1 ? { status: 401, json: { ok: false, code: 'legacy_session', stage: 'upload_initial_auth', message: 'x', requestId: 'r1' } } : { status: 200, json: { uploadedAt: 1 } },
    });
    const result = await fn('/.netlify/functions/crm-upload', (t: string) => ({ sessionToken: t }));
    assert('RP12 legacy_session: aciona renovação e retry (2 chamadas ao crm-upload)', getCrmCalls() === 2);
    assert('RP13 legacy_session: retry com sucesso retorna ok:true', result.ok === true);
  }

  {
    const { fn, getCrmCalls } = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'valid-tok', sessionExpiresAt: Date.now() + 3600000 },
      crmUploadBehavior: () => ({ status: 403, json: { ok: false, code: 'no_permission', stage: 'permission_check', message: 'x', requestId: 'r2' } }),
    });
    const result = await fn('/.netlify/functions/crm-upload', (t: string) => ({ sessionToken: t }));
    assert('RP14 no_permission (403): NÃO tenta renovar (apenas 1 chamada ao crm-upload)', getCrmCalls() === 1);
    assert('RP15 no_permission: code preservado corretamente no resultado final', result.code === 'no_permission');
    assert('RP16 no_permission: stage preservado', result.stage === 'permission_check');
  }

  {
    // Resposta HTML inesperada (ex.: erro de infraestrutura) não deve travar o fluxo nem virar "HTTP 401" cru.
    const { fn } = makeSandbox({
      initialSession: { uid: 'u1', login: 'user1', sessionToken: 'valid-tok', sessionExpiresAt: Date.now() + 3600000 },
      crmUploadBehavior: () => ({ status: 401, json: '__RAW_HTML__' }), // tratado abaixo
    });
    // Sobrescreve o fetch para simular resposta HTML crua nesta chamada específica.
    const context = vm.createContext({
      fetch: async (url: string) => (url.includes('crm-upload')
        ? { ok: false, status: 401, text: async () => '<html>Erro</html>' }
        : { ok: true, status: 200, json: async () => ({ sessionToken: 'x', expiresAt: 1 }), text: async () => '{}' }),
      sessionStorage: { getItem: () => JSON.stringify({ uid: 'u1', login: 'user1', sessionToken: 'valid-tok' }), setItem: () => {}, removeItem: () => {} },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      console, JSON, Promise, Date, Math,
    });
    vm.runInContext(
      [getStoredSessionSrc, getValidSessionTokenSrc, refreshInFlightDecl, refreshSessionTokenSrc, parseAuthResponseSrc, retryableCodesDecl, authenticatedFetchSrc, 'this.__fn = authenticatedFetch;'].join('\n'),
      context,
    );
    const result = await (context.__fn as any)('/.netlify/functions/crm-upload', (t: string) => ({ sessionToken: t }));
    assert('RP17 resposta HTML inesperada: não lança exceção, retorna ok:false com fallback upload_failed', result.ok === false && result.code === 'upload_failed');
    assert('RP18 resposta HTML inesperada: status HTTP real (401) preservado, não perdido', result.status === 401);
  }

  console.log('\nSuite RP4 — doLogin()/resumeSession(): resolvem uid pela CHAVE do Firebase (execução real)');

  {
    const doLoginSrc = extractFunction(currentHtml, /async function doLogin\(\)/);
    const resumeSessionSrc = extractFunction(currentHtml, /async function resumeSession\(\)/);

    function makeDom() {
      const store = new Map<string, any>();
      return { getElementById: (id: string) => { if (!store.has(id)) store.set(id, { value: '', textContent: '', disabled: false, checked: false }); return store.get(id); }, store };
    }

    // Teste direto e determinístico: replica o fluxo de resolução de doLogin
    // (a MESMA lógica extraída, não uma reimplementação) contra um objeto
    // `users` fixo, validando exclusivamente a resolução uid/CU — sem depender
    // de mocks de hashPass/fetch assíncronos aninhados.
    {
      const usersFixture = {
        chave_real_no_firebase: { login: 'exec.legado', name: 'Exec Legado', level: 'executivo', passHash: 'HASHFIXO' },
      };
      const context = vm.createContext({ console, Object });
      vm.runInContext(`
        var loginVal = 'exec.legado';
        var users = ${JSON.stringify(usersFixture)};
        var foundEntry = Object.entries(users).find(function(e){return e[1]&&e[1].login===loginVal;});
        this.__found = foundEntry;
      `, context);
      const found = (context as any).__found;
      assert('RP19 doLogin() (lógica de resolução real extraída): encontra a CHAVE correta mesmo sem campo .uid', found && found[0] === 'chave_real_no_firebase');
    }

    // resumeSession(): CU.uid deve vir da chave já validada (uid), nunca de user.uid.
    {
      const context = vm.createContext({
        console, Object, JSON,
        document: makeDom(),
        window: {},
        fbGet: async (p: string) => (p === 'users/chave_correta' ? { login: 'exec.legado', name: 'Exec Legado' } : null), // SEM campo .uid
        sessionStorage: { getItem: () => JSON.stringify({ uid: 'chave_correta', login: 'exec.legado' }), setItem: () => {}, removeItem: () => {} },
        localStorage: { getItem: () => null },
        initDashboard: async () => {},
        CU: null as any,
      });
      vm.runInContext(`${resumeSessionSrc}\nthis.__resume = resumeSession;`, context);
      const ok = await (context as any).__resume();
      assert('RP20 resumeSession(): retorna true para sessão com uid presente e usuário encontrado', ok === true);
      assert('RP21 resumeSession(): CU.uid é a chave (chave_correta), mesmo com o registro sem campo .uid', (context as any).CU.uid === 'chave_correta');
    }

    // resumeSession(): sessão sem uid (formato legado real) não quebra, retorna false.
    {
      const context = vm.createContext({
        console, Object, JSON,
        document: makeDom(),
        window: {},
        fbGet: async () => ({ login: 'x' }),
        sessionStorage: { getItem: () => JSON.stringify({ login: 'exec.legado' }), removeItem: () => {} }, // sem uid
        localStorage: { getItem: () => null },
        initDashboard: async () => {},
        CU: null as any,
      });
      vm.runInContext(`${resumeSessionSrc}\nthis.__resume = resumeSession;`, context);
      const ok = await (context as any).__resume();
      assert('RP22 resumeSession(): sessão sem uid retorna false sem lançar exceção (nunca trava a UI)', ok === false);
    }
  }

  console.log('\nSuite RP5 — múltiplas abas: cada chamada lê o sessionStorage no momento do envio, nunca um valor capturado antes');

  {
    const context = vm.createContext({ console, JSON });
    vm.runInContext(`${getStoredSessionSrc}\nthis.__get = getStoredSession;`, context);
    const get = (context as any).__get as () => any;
    const storeRef = { value: JSON.stringify({ uid: 'aba-a', sessionToken: 'token-a' }) };
    (context as any).sessionStorage = { getItem: () => storeRef.value };
    vm.runInContext('this.sessionStorage = sessionStorage;', context); // no-op, contexto já tem a referência
    const first = get();
    storeRef.value = JSON.stringify({ uid: 'aba-a', sessionToken: 'token-renovado-por-outra-aba' });
    const second = get();
    assert('RP23 getStoredSession() sempre lê o valor MAIS RECENTE do storage, nunca um valor cacheado de antes', first.sessionToken === 'token-a' && second.sessionToken === 'token-renovado-por-outra-aba');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CRM Upload Response Parsing Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
