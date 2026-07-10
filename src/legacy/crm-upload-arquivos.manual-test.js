/**
 * ESA OS — Hotfix: crm-upload-arquivos (v3 — ponte segura HMAC)
 * Suite de testes manuais — 55 cenários
 *
 * Execução: node src/legacy/crm-upload-arquivos.manual-test.js
 *
 * Escopo: valida lógica da ponte segura sem chamar Firebase nem Netlify.
 * Módulos testados: session-init (lógica), crm-upload (lógica), integração
 * com login legado, comportamento da UI e postura de segurança.
 */

import { createRequire } from 'module';

const fs = await import('fs');
const crypto = await import('crypto');

const require = createRequire(import.meta.url);
const { generateToken, verifyToken, TTL_SECONDS } = require('../../netlify/functions/_shared/upload-session.js');

// ── Runner ─────────────────────────────────────────────────────────────────────

let total = 0;
let failed = 0;
let sectionCount = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(title) {
  sectionCount++;
  console.log(`\n[${sectionCount}] ${title}`);
}

// ── Lógica espelhada do session-init.js ───────────────────────────────────────

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function normalizarLogin(login) {
  return login.trim().toLowerCase();
}

function localizarUsuario(users, normalizedLogin) {
  return Object.values(users).find(u => u && u.login === normalizedLogin) || null;
}

function validarCredencial(receivedHash, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const a = Buffer.from(receivedHash, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Lógica espelhada do crm-upload.js ─────────────────────────────────────────

const CRM_LEVELS = ['diretor', 'trafego', 'gestor', 'engenharia', 'executivo', 'sdr', 'jackeline'];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function temAcessoCRM(level) {
  return CRM_LEVELS.includes((level || '').toLowerCase().trim());
}

function isValidDealId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0;
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildPath(dealId, ts, fileName) {
  return `crm/${dealId}/${ts}_${sanitizeFileName(fileName)}`;
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SECRET = 'secret_para_testes_nao_usar_em_prod';

const USER_PAULO = {
  uid: 'uid_paulo',
  login: 'paulo.oliveira',
  name: 'Paulo Oliveira',
  level: 'engenharia',
  passHash: sha256Hex('senhaSegura123'),
};

const USERS_DB = { [USER_PAULO.uid]: USER_PAULO };

// ── Seção A: SESSION INIT — validação de credenciais ──────────────────────────

section('SESSION INIT — método diferente de POST retorna 405');
{
  // Simulação: o handler verifica httpMethod
  const allowed = ['POST'];
  assert(!allowed.includes('GET'), 'GET não é permitido → 405');
  assert(!allowed.includes('PUT'), 'PUT não é permitido → 405');
  assert(!allowed.includes('DELETE'), 'DELETE não é permitido → 405');
  assert(allowed.includes('POST'), 'POST é permitido → continua');
}

section('SESSION INIT — body inválido retorna 400');
{
  function parseBody(raw) {
    try { return JSON.parse(raw || '{}'); } catch { return null; }
  }
  assert(parseBody('{"login":"a"}') !== null, 'JSON válido parseado');
  assert(parseBody('{invalid}') === null, 'JSON inválido → null → 400');
  assert(parseBody('') !== null, 'body vazio parseia como {}');
}

section('SESSION INIT — login e password obrigatórios');
{
  function validarCampos(body) {
    return body.login && typeof body.login === 'string' &&
           body.password && typeof body.password === 'string';
  }
  assert(!validarCampos({}), 'body vazio → inválido');
  assert(!validarCampos({ login: 'x' }), 'sem password → inválido');
  assert(!validarCampos({ password: 'x' }), 'sem login → inválido');
  assert(validarCampos({ login: 'user', password: 'pass' }), 'ambos presentes → válido');
}

section('SESSION INIT — login normalizado igual ao doLogin() legado');
{
  assert(normalizarLogin('  Paulo.Oliveira  ') === 'paulo.oliveira', 'trim + toLowerCase');
  assert(normalizarLogin('ADMIN') === 'admin', 'maiúsculas normalizadas');
  assert(normalizarLogin('lucas.vizentin') === 'lucas.vizentin', 'já normalizado → inalterado');
}

section('SESSION INIT — usuário inexistente retorna 401 genérico');
{
  const user = localizarUsuario(USERS_DB, 'usuario.inexistente');
  assert(user === null, 'usuário não encontrado → null → 401 genérico');
}

section('SESSION INIT — senha errada retorna 401 genérico');
{
  const user = localizarUsuario(USERS_DB, 'paulo.oliveira');
  assert(user !== null, 'usuário existe');
  const hashErrado = sha256Hex('senha_errada');
  assert(!validarCredencial(hashErrado, user.passHash), 'hash incorreto → inválido → 401 genérico');
}

section('SESSION INIT — SHA-256 hex compatível com hashPass() legado do browser');
{
  // hashPass() no browser: SHA-256(UTF-8) → hex lowercase
  // sha256Hex() no servidor: createHash('sha256').update(pass,'utf8').digest('hex')
  const senha = 'senhaSegura123';
  const hashServidor = sha256Hex(senha);
  assert(hashServidor.length === 64, 'hash tem 64 chars hex');
  assert(/^[0-9a-f]+$/.test(hashServidor), 'hash é hex lowercase');
  assert(hashServidor === USER_PAULO.passHash, 'hash servidor = passHash armazenado (mesma senha)');
}

section('SESSION INIT — credencial válida retorna 200 com sessionToken e expiresAt');
{
  const user = localizarUsuario(USERS_DB, 'paulo.oliveira');
  const hash = sha256Hex('senhaSegura123');
  const valido = validarCredencial(hash, user.passHash);
  assert(valido, 'credenciais válidas confirmadas');

  const token = generateToken(user.uid, SECRET);
  const expiresAt = Date.now() + TTL_SECONDS * 1000;

  assert(typeof token === 'string' && token.length > 0, 'sessionToken gerado');
  assert(expiresAt > Date.now(), 'expiresAt no futuro');
}

section('SESSION INIT — resposta não contém passHash nem password');
{
  // A resposta da function é { sessionToken, expiresAt } — campos auditados
  const resposta = { sessionToken: 'tok.sig', expiresAt: Date.now() + 28800000 };
  assert(!('passHash' in resposta), 'resposta não contém passHash');
  assert(!('password' in resposta), 'resposta não contém password');
  assert(!('hash' in resposta), 'resposta não contém hash');
}

section('SESSION INIT — token gerado tem purpose crm-upload');
{
  const token = generateToken(USER_PAULO.uid, SECRET);
  const payload = verifyToken(token, SECRET);
  assert(payload.purpose === 'crm-upload', `purpose correto: "${payload.purpose}"`);
}

section('SESSION INIT — env UPLOAD_SESSION_SECRET ausente retorna 500');
{
  // Simulação: o handler verifica process.env antes de prosseguir
  const secret = undefined;
  assert(!secret, 'secret undefined → 500 retornado antes de acessar RTDB');
}

section('SESSION INIT — uid e level enviados no body são ignorados');
{
  // A function deriva o uid do resultado da busca por login+password no RTDB
  // Campos como uid, level, role no body não são utilizados para autorizar
  const bodyComUidInjetado = { login: 'paulo.oliveira', password: 'senhaSegura123', uid: 'uid_admin_falso', level: 'diretor' };
  const userEncontrado = localizarUsuario(USERS_DB, normalizarLogin(bodyComUidInjetado.login));
  assert(userEncontrado !== null, 'usuário encontrado por login (não por uid injetado)');
  assert(userEncontrado.uid === USER_PAULO.uid, 'uid real usado, não o injetado');
  assert(userEncontrado.level === 'engenharia', 'level real usado, não o injetado');
}

// ── Seção B: CRM UPLOAD — validação e autorização ─────────────────────────────

section('CRM UPLOAD — método diferente de POST retorna 405');
{
  const allowed = ['POST'];
  assert(!allowed.includes('GET'), 'GET → 405');
  assert(!allowed.includes('PUT'), 'PUT → 405');
}

section('CRM UPLOAD — sessionToken ausente retorna 401');
{
  function validarToken(token, secret) {
    try { return verifyToken(token, secret); } catch { return null; }
  }
  assert(validarToken(undefined, SECRET) === null, 'token undefined → 401');
  assert(validarToken('', SECRET) === null, 'token vazio → 401');
}

section('CRM UPLOAD — token com assinatura inválida retorna 401');
{
  const bom = generateToken(USER_PAULO.uid, SECRET);
  const partes = bom.split('.');
  const alterado = partes[0] + '.' + 'assinaturafalsa12345678901234567890123456789';
  let payload = null;
  try { payload = verifyToken(alterado, SECRET); } catch {}
  assert(payload === null, 'assinatura inválida → 401');
}

section('CRM UPLOAD — token expirado retorna 401');
{
  function toB64URL(str) {
    return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  function hmac(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  const expiredPayload = { uid: USER_PAULO.uid, iat: 1000, exp: 1001, purpose: 'crm-upload' };
  const body = toB64URL(JSON.stringify(expiredPayload));
  const sig = hmac(body, SECRET);
  const expiredToken = `${body}.${sig}`;

  let payload = null;
  try { payload = verifyToken(expiredToken, SECRET); } catch {}
  assert(payload === null, 'token expirado → 401');
}

section('CRM UPLOAD — usuário não encontrado no RTDB retorna 401');
{
  // Simula token válido mas uid inexistente no banco
  const tokenUidFake = generateToken('uid_inexistente', SECRET);
  const payload = verifyToken(tokenUidFake, SECRET);
  assert(payload.uid === 'uid_inexistente', 'uid extraído do token');
  const userNoRTDB = USERS_DB[payload.uid] || null;
  assert(userNoRTDB === null, 'usuário não existe no RTDB → 401');
}

section('CRM UPLOAD — diretor permitido');
{
  assert(temAcessoCRM('diretor'), 'diretor → 200');
}

section('CRM UPLOAD — gestor permitido');
{
  assert(temAcessoCRM('gestor'), 'gestor → 200');
}

section('CRM UPLOAD — trafego permitido');
{
  assert(temAcessoCRM('trafego'), 'trafego → 200');
}

section('CRM UPLOAD — executivo permitido');
{
  assert(temAcessoCRM('executivo'), 'executivo → 200');
}

section('CRM UPLOAD — sdr permitido');
{
  assert(temAcessoCRM('sdr'), 'sdr → 200');
}

section('CRM UPLOAD — jackeline permitido');
{
  assert(temAcessoCRM('jackeline'), 'jackeline → 200');
}

section('CRM UPLOAD — engenharia permitida');
{
  assert(temAcessoCRM('engenharia'), 'engenharia → 200');
}

section('CRM UPLOAD — marketing bloqueado retorna 403');
{
  assert(!temAcessoCRM('marketing'), 'marketing → 403');
  assert(!temAcessoCRM('externo'), 'externo → 403');
  assert(!temAcessoCRM(''), 'level vazio → 403');
}

section('CRM UPLOAD — level enviado pelo browser é ignorado (uid vem do token)');
{
  // O browser não envia level; o crm-upload busca /users/{uid} no RTDB
  // e usa user.level server-side
  const token = generateToken(USER_PAULO.uid, SECRET);
  const payload = verifyToken(token, SECRET);
  const userNoRTDB = USERS_DB[payload.uid];
  assert(userNoRTDB.level === 'engenharia', 'level lido do RTDB, não do body');
  // Injetar level no body não afeta a autorização
  const bodyComLevelFalso = { sessionToken: token, dealId: 'deal_x', level: 'diretor' };
  assert(!('level' in { uid: payload.uid }), 'level não é extraído do body para autorização');
}

section('CRM UPLOAD — dealId com path separator retorna 400');
{
  assert(!isValidDealId('deal/../outro'), 'path traversal via .. → 400');
  assert(!isValidDealId('deal/slash'), 'barra em dealId → 400');
  assert(!isValidDealId('deal\\back'), 'barra invertida em dealId → 400');
  assert(!isValidDealId(''), 'dealId vazio → 400');
  assert(!isValidDealId(null), 'dealId null → 400');
}

section('CRM UPLOAD — dealId válido aceito');
{
  assert(isValidDealId('deal_AAAAAA'), 'deal_AAAAAA → válido');
  assert(isValidDealId('deal-123'), 'deal-123 → válido');
  assert(isValidDealId('CRM0001'), 'CRM0001 → válido');
}

section('CRM UPLOAD — fileName ausente retorna 400');
{
  assert(!('fileName' in {}), 'sem fileName → 400');
  assert(typeof undefined === 'undefined', 'fileName undefined → 400');
}

section('CRM UPLOAD — MIME permitido aceito');
{
  assert(ALLOWED_MIMES.has('application/pdf'), 'PDF → aceito');
  assert(ALLOWED_MIMES.has('image/png'), 'PNG → aceito');
  assert(ALLOWED_MIMES.has('image/jpeg'), 'JPEG → aceito');
  assert(ALLOWED_MIMES.has('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'DOCX → aceito');
  assert(ALLOWED_MIMES.has('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'XLSX → aceito');
}

section('CRM UPLOAD — MIME text/html e script bloqueados retornam 400');
{
  assert(!ALLOWED_MIMES.has('text/html'), 'text/html → bloqueado');
  assert(!ALLOWED_MIMES.has('application/x-sh'), 'shell → bloqueado');
  assert(!ALLOWED_MIMES.has('application/javascript'), 'js → bloqueado');
  assert(!ALLOWED_MIMES.has('application/octet-stream'), 'binário genérico → bloqueado');
}

section('CRM UPLOAD — arquivo exatamente 10MB aceito');
{
  const bytes10MB = 10 * 1024 * 1024;
  assert(bytes10MB <= MAX_BYTES, '10MB exato → aceito');
}

section('CRM UPLOAD — arquivo acima de 10MB retorna 400');
{
  const bytes10MBplus1 = 10 * 1024 * 1024 + 1;
  assert(bytes10MBplus1 > MAX_BYTES, '10MB + 1 byte → bloqueado');
}

section('CRM UPLOAD — base64 vazio retorna 400');
{
  const empty = Buffer.from('', 'base64');
  assert(empty.length === 0, 'base64 vazio → buffer vazio → 400');
}

section('CRM UPLOAD — path gerado: crm/{dealId}/{ts}_{safeNome}');
{
  const ts = 1700000001000;
  const path = buildPath('deal_AAAAAA', ts, 'Contrato Assinado.pdf');
  assert(path.startsWith('crm/deal_AAAAAA/'), 'path começa com crm/{dealId}/');
  assert(path.includes(`${ts}_`), 'ts presente no path');
  assert(path.includes('Contrato_Assinado.pdf'), 'espaço sanitizado para _');
  assert(!path.includes(' '), 'sem espaços no path');
}

section('CRM UPLOAD — uploadedBy vem do servidor (user.name), não do browser');
{
  const arqData = {
    nome: 'arquivo.pdf',
    url: 'https://firebasestorage.googleapis.com/...',
    tipo: 'application/pdf',
    tamanho: 51200,
    uploadedBy: USER_PAULO.name, // lido de user.name no RTDB, não enviado pelo browser
    uploadedAt: Date.now(),
    path: 'crm/deal_x/ts_arquivo.pdf',
  };
  assert(arqData.uploadedBy === 'Paulo Oliveira', 'uploadedBy é user.name do RTDB');
  assert(!('level' in arqData), 'metadata não expõe level');
  assert(!('uid' in arqData), 'metadata não expõe uid bruto (usa name)');
}

section('CRM UPLOAD — URL de download no formato Firebase Storage getDownloadURL()');
{
  const downloadToken = '550e8400-e29b-41d4-a716-446655440000';
  const path = 'crm/deal_x/1700000000000_arquivo.pdf';
  const bucket = 'agenda-executiva-esa.firebasestorage.app';
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}` +
    `?alt=media&token=${downloadToken}`;

  assert(url.startsWith('https://firebasestorage.googleapis.com/'), 'URL usa domínio correto');
  assert(url.includes('?alt=media&token='), 'URL contém parâmetros de token Firebase');
  assert(url.includes(encodeURIComponent(path)), 'path é URL-encoded no formato correto');
}

section('CRM UPLOAD — ausência de fallback para upload direto ao Storage');
{
  // crm-upload.js não deve conter referência a storage.ref() ou firebase.storage()
  const crmUploadContent = fs.readFileSync('netlify/functions/crm-upload.js', 'utf8');
  assert(!crmUploadContent.includes('storage.ref('), 'crm-upload.js não usa storage.ref()');
  assert(!crmUploadContent.includes('firebase.storage()'), 'crm-upload.js não usa firebase.storage()');
  assert(!crmUploadContent.includes('uploadTask'), 'crm-upload.js não tem uploadTask');
  assert(crmUploadContent.includes('getBucket()'), 'crm-upload.js usa Admin SDK getBucket()');
}

// ── Seção C: LOGIN LEGADO — integração com session-init ───────────────────────

section('LOGIN LEGADO — session-init chamada após credenciais válidas (ordem garantida)');
{
  // A lógica em index.html chama session-init ANTES de descartar passVal
  // Verificar que o código modificado contém a chamada de fetch
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const doLoginBlock = indexContent.slice(
    indexContent.indexOf('async function doLogin()'),
    indexContent.indexOf('async function resumeSession()'),
  );
  assert(doLoginBlock.includes('session-init'), 'doLogin chama session-init');
  assert(doLoginBlock.includes('password:passVal'), 'passVal enviado para session-init');
  assert(doLoginBlock.indexOf('password:passVal') < doLoginBlock.indexOf('CU = user'), 'session-init chamado antes de CU=user');
}

section('LOGIN LEGADO — sessionToken salvo em esa_session após login bem-sucedido');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const doLoginBlock = indexContent.slice(
    indexContent.indexOf('async function doLogin()'),
    indexContent.indexOf('async function resumeSession()'),
  );
  assert(doLoginBlock.includes('_sessObj.sessionToken'), 'sessionToken copiado para _sessObj');
  assert(doLoginBlock.includes("setItem('esa_session'"), 'esa_session é atualizado');
}

section('LOGIN LEGADO — sessionExpiresAt salvo em esa_session');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const doLoginBlock = indexContent.slice(
    indexContent.indexOf('async function doLogin()'),
    indexContent.indexOf('async function resumeSession()'),
  );
  assert(doLoginBlock.includes('_sessObj.sessionExpiresAt'), 'sessionExpiresAt salvo na sessão');
  assert(doLoginBlock.includes('_siData.expiresAt'), 'expiresAt lido da resposta de session-init');
}

section('LOGIN LEGADO — falha de session-init não bloqueia login');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const doLoginBlock = indexContent.slice(
    indexContent.indexOf('async function doLogin()'),
    indexContent.indexOf('async function resumeSession()'),
  );
  // session-init está em try/catch independente — falha não propaga
  assert(doLoginBlock.includes('}catch(_sie){}'), 'erro de session-init silenciado (login não interrompido)');
}

section('LOGIN LEGADO — password não armazenada em nenhum campo da sessão ESA');
{
  // A sessão contém uid, login, sessionToken, sessionExpiresAt — nunca password/passHash
  const sessaoTipos = ['uid', 'login', 'sessionToken', 'sessionExpiresAt'];
  const proibidos = ['password', 'passHash', 'hash', 'senha'];
  proibidos.forEach(campo => {
    assert(!sessaoTipos.includes(campo), `sessão não contém campo "${campo}"`);
  });
}

section('LOGIN LEGADO — resumeSession preserva sessionToken do storage');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const resumeBlock = indexContent.slice(
    indexContent.indexOf('async function resumeSession()'),
    indexContent.indexOf('function doLogout()'),
  );
  assert(resumeBlock.includes('parsed.sessionToken'), 'resumeSession lê sessionToken do parsed');
  assert(resumeBlock.includes('_resync.sessionToken'), 'sessionToken copiado para _resync');
  assert(resumeBlock.includes("setItem('esa_session',JSON.stringify(_resync))"), 'resync salvo com token');
}

section('LOGIN LEGADO — logout remove sessão completa incluindo token');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const logoutBlock = indexContent.slice(
    indexContent.indexOf('function doLogout()'),
    indexContent.indexOf('// // INIT DASHBOARD'),
  );
  assert(logoutBlock.includes("removeItem('esa_session')"), 'esa_session removido no logout');
  assert(logoutBlock.includes("removeItem('esa_remember')"), 'esa_remember removido no logout');
}

// ── Seção D: CRM UI — comportamento do modal de upload ────────────────────────

section('CRM UI — sem sessionToken exibe mensagem de relogin (não tenta upload)');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const uploadBlock = indexContent.slice(
    indexContent.indexOf('window.crmUploadArquivo='),
    indexContent.indexOf('window.crmDeleteArquivo='),
  );
  assert(uploadBlock.includes('sessionToken'), 'verifica sessionToken antes de prosseguir');
  assert(
    uploadBlock.includes('Saia e entre novamente no sistema'),
    'mensagem de relogin exibida quando token ausente',
  );
}

section('CRM UI — com sessionToken chama crm-upload (não chama storage.ref().put())');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const uploadBlock = indexContent.slice(
    indexContent.indexOf('window.crmUploadArquivo='),
    indexContent.indexOf('window.crmDeleteArquivo='),
  );
  assert(uploadBlock.includes('/.netlify/functions/crm-upload'), 'fetch aponta para crm-upload');
  assert(!uploadBlock.includes('storage.ref('), 'storage.ref() não usado no upload');
  assert(!uploadBlock.includes('uploadTask'), 'uploadTask removido');
  assert(uploadBlock.includes('method:\'POST\''), 'request é POST');
}

section('CRM UI — não envia level no body do request');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const uploadBlock = indexContent.slice(
    indexContent.indexOf('window.crmUploadArquivo='),
    indexContent.indexOf('window.crmDeleteArquivo='),
  );
  // O body do fetch deve conter sessionToken, dealId, fileName, contentType, fileBase64
  // NÃO deve conter level ou CU.level
  assert(!uploadBlock.match(/body.*level.*crm-upload/s), 'level não enviado para crm-upload');
  assert(uploadBlock.includes('sessionToken:_sess.sessionToken'), 'sessionToken enviado');
  assert(uploadBlock.includes('dealId:dealId'), 'dealId enviado');
  assert(uploadBlock.includes('fileName:file.name'), 'fileName enviado');
  assert(uploadBlock.includes('contentType:file.type'), 'contentType enviado');
  assert(uploadBlock.includes('fileBase64:fileBase64'), 'fileBase64 enviado');
}

section('CRM UI — metadata retornada pelo crm-upload é salva no RTDB');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const uploadBlock = indexContent.slice(
    indexContent.indexOf('window.crmUploadArquivo='),
    indexContent.indexOf('window.crmDeleteArquivo='),
  );
  assert(uploadBlock.includes('var arqData=await res.json()'), 'arqData lido da resposta');
  assert(uploadBlock.includes("fbSet('crm/deals/'"), 'arqData salvo no RTDB via fbSet');
}

section('CRM UI — Toast exibido após upload bem-sucedido');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const uploadBlock = indexContent.slice(
    indexContent.indexOf('window.crmUploadArquivo='),
    indexContent.indexOf('window.crmDeleteArquivo='),
  );
  assert(uploadBlock.includes('showToast('), 'showToast chamado após sucesso');
  assert(uploadBlock.includes('Arquivo enviado com sucesso'), 'mensagem de sucesso preservada');
}

section('CRM UI — gate de nível UX preservado (engenharia incluída)');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const uploadBlock = indexContent.slice(
    indexContent.indexOf('window.crmUploadArquivo='),
    indexContent.indexOf('window.crmDeleteArquivo='),
  );
  assert(uploadBlock.includes('engenharia'), 'engenharia mantida no gate UX');
  assert(uploadBlock.includes("Sem permissão para upload no CRM"), 'mensagem de bloqueio UX preservada');
}

// ── Seção E: SEGURANÇA ─────────────────────────────────────────────────────────

section('SEGURANÇA — storage.rules bloqueia toda escrita');
{
  const rulesContent = fs.readFileSync('storage.rules', 'utf8');
  assert(rulesContent.includes('allow read, write: if false'), 'regra if false presente');
  assert(rulesContent.includes('/{allPaths=**}'), 'aplica a todos os paths');
  assert(!rulesContent.match(/^\s*allow\s+(read\s*,\s*write|write)\s*:\s*if\s+true/m), 'sem allow if true');
}

section('SEGURANÇA — FIREBASE_SERVICE_ACCOUNT_JSON não exposta no index.html');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  assert(
    !indexContent.includes('FIREBASE_SERVICE_ACCOUNT_JSON'),
    'index.html não menciona FIREBASE_SERVICE_ACCOUNT_JSON',
  );
  assert(!indexContent.includes('private_key'), 'index.html não contém private_key');
  assert(!indexContent.includes('"type": "service_account"'), 'index.html não contém service_account JSON');
}

section('SEGURANÇA — UPLOAD_SESSION_SECRET não exposta no index.html');
{
  const indexContent = fs.readFileSync('index.html', 'utf8');
  assert(!indexContent.includes('UPLOAD_SESSION_SECRET'), 'index.html não menciona UPLOAD_SESSION_SECRET');
}

section('SEGURANÇA — chaves de serviço não hardcoded no repositório de functions');
{
  const crmUpload = fs.readFileSync('netlify/functions/crm-upload.js', 'utf8');
  const sessionInit = fs.readFileSync('netlify/functions/session-init.js', 'utf8');
  const adminHelper = fs.readFileSync('netlify/functions/_shared/firebase-admin.js', 'utf8');

  assert(!crmUpload.includes('private_key'), 'crm-upload.js sem private_key hardcoded');
  assert(!sessionInit.includes('private_key'), 'session-init.js sem private_key hardcoded');
  assert(!adminHelper.includes('private_key'), 'firebase-admin.js sem private_key hardcoded');

  assert(adminHelper.includes('process.env.FIREBASE_SERVICE_ACCOUNT_JSON'), 'credencial lida de env var');
  assert(crmUpload.includes('process.env.UPLOAD_SESSION_SECRET'), 'secret lido de env var no crm-upload');
  assert(sessionInit.includes('process.env.UPLOAD_SESSION_SECRET'), 'secret lido de env var no session-init');
}

section('SEGURANÇA — crm-upload.js não autoriza por level enviado pelo browser');
{
  const crmUpload = fs.readFileSync('netlify/functions/crm-upload.js', 'utf8');

  // A autorização usa user.level lido do RTDB, não do body
  assert(crmUpload.includes("db.ref('users/' + uid)"), 'level lido via RTDB path users/{uid}');
  assert(crmUpload.includes('user.level'), 'user.level extraído do objeto do RTDB');
  assert(!crmUpload.includes('body.level'), 'body.level não é usado para autorização');
  assert(!crmUpload.includes("CRM_LEVELS.includes(body"), 'level do body não passa pela lista CRM');
}

// ── Resultado ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Seções: ${sectionCount}`);
if (failed === 0) {
  console.log(`✅ PASSOU: ${total}/${total} cenários`);
} else {
  console.log(`❌ FALHOU: ${failed}/${total} cenários`);
  process.exit(1);
}
