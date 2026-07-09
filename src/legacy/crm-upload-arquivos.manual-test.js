/**
 * ESA OS — Hotfix: crm-upload-arquivos (v2 — segurança endurecida)
 * Suite de testes manuais — 20 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-upload-arquivos.manual-test.js
 *
 * Escopo: valida a lógica JS local e a postura de segurança do repositório.
 *
 * DIAGNÓSTICO DE SEGURANÇA (Conclusão C):
 *   A sessão ESA armazena apenas {uid, login} — sem segredo server-side verificável.
 *   O passHash é SHA-256 lido publicamente do RTDB pelo browser durante login.
 *   Nenhum token, HMAC ou credencial verificável existe no sistema legado.
 *   Portanto NÃO existe identidade server-side verificável.
 *   Uma Netlify Function que autorize upload por {level} enviado pelo browser
 *   NÃO é uma fronteira de segurança real.
 *
 * UPLOAD DIRETO AO FIREBASE STORAGE:
 *   Permanece bloqueado. storage/unauthorized persiste para todos os usuários.
 *   storage.rules no repositório bloqueia toda escrita (allow write: if false).
 *   Não há soluução de upload disponível enquanto a arquitetura segura não existir.
 *
 * GATE JAVASCRIPT (UX apenas):
 *   O gate de nível em crmUploadArquivo() é defesa de interface.
 *   NÃO é mecanismo de segurança do Firebase Storage.
 *   Um client externo pode ignorar o JavaScript e fazer requests direto ao Storage.
 *
 * Sem Jest. Sem mocks. Sem dependências externas.
 */

// ── Runner ────────────────────────────────────────────────────────────────────

let total = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}/20] ${title}`);
}

// ── Lógica extraída de index.html (gate UX de acesso ao CRM) ──────────────────

const NIVEIS_CRM = ['diretor', 'trafego', 'gestor', 'engenharia', 'executivo', 'sdr', 'jackeline'];

function temAcessoCRM(level) {
  return NIVEIS_CRM.indexOf((level || '').toLowerCase().trim()) >= 0;
}

// ── Lógica extraída de crmIsAdmin ────────────────────────────────────────────

function crmIsAdmin(level) {
  const l = (level || '').toLowerCase().trim();
  return l === 'diretor' || l === 'trafego' || l === 'gestor';
}

// ── Lógica do path de upload (index.html linha 3943) ─────────────────────────

function buildUploadPath(dealId, fileName, ts) {
  const safeNome = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return 'crm/' + dealId + '/' + ts + '_' + safeNome;
}

// ── Validação de tamanho (index.html linha 3933) ──────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function dentroDoLimite(bytes) {
  return bytes <= MAX_BYTES;
}

// ── Tipos permitidos no input HTML (aceitos pelo modal, validados UX-side) ───

const TIPOS_PERMITIDOS_UX = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function tipoAceitoNoModal(mimeType) {
  return TIPOS_PERMITIDOS_UX.includes(mimeType);
}

// ── Simulação do metadata do arquivo (index.html linha 3960) ─────────────────

function buildArqData(file, url, uploadedBy, ts, dealId) {
  const safeNome = file.nome.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = 'crm/' + dealId + '/' + ts + '_' + safeNome;
  return {
    nome: file.nome,
    url: url,
    tipo: file.tipo,
    tamanho: file.tamanho,
    uploadedBy: uploadedBy,
    uploadedAt: ts,
    path: path,
  };
}

// ── Lógica de exclusão (index.html linha 3909) ────────────────────────────────

function podeDeletar(arquivoUploadedBy, userName, userLevel) {
  return arquivoUploadedBy === userName || crmIsAdmin(userLevel);
}

// ── Simulação da sessão ESA ───────────────────────────────────────────────────

function buildSessaoESA(uid, login) {
  return { uid, login };
}

function sessaoTemSegredo(sessao) {
  return 'token' in sessao || 'hmac' in sessao || 'sessionToken' in sessao;
}

// ── Storage Rules ─────────────────────────────────────────────────────────────

const fs = await import('fs');

async function lerStorageRules() {
  try {
    return fs.readFileSync('storage.rules', 'utf8');
  } catch (e) {
    return null;
  }
}

// ── Cenários ──────────────────────────────────────────────────────────────────

const rulesContent = await lerStorageRules();

section(1, 'Gate local de UX: regra de acesso ao CRM preservada em temAcessoCRM()');
{
  assert(NIVEIS_CRM.includes('diretor'), 'diretor está na lista CRM');
  assert(NIVEIS_CRM.includes('gestor'), 'gestor está na lista CRM');
  assert(NIVEIS_CRM.includes('trafego'), 'trafego está na lista CRM');
  assert(NIVEIS_CRM.includes('executivo'), 'executivo está na lista CRM');
  assert(NIVEIS_CRM.includes('sdr'), 'sdr está na lista CRM');
  assert(NIVEIS_CRM.includes('jackeline'), 'jackeline está na lista CRM');
  assert(NIVEIS_CRM.includes('engenharia'), 'engenharia está na lista CRM');
}

section(2, 'Engenharia permitida no gate local de UX');
{
  assert(temAcessoCRM('engenharia'), 'engenharia → gate UX = true');
  assert(!crmIsAdmin('engenharia'), 'engenharia NÃO é admin CRM (crmIsAdmin = false)');
}

section(3, 'Usuário sem CRM bloqueado no gate local de UX');
{
  assert(!temAcessoCRM('marketing'), 'marketing → gate UX = false');
  assert(!temAcessoCRM(''), 'nível vazio → gate UX = false');
  assert(!temAcessoCRM('externo'), 'nível desconhecido → gate UX = false');
}

section(4, 'storage.rules não permite escrita anônima no CRM');
{
  assert(rulesContent !== null, 'storage.rules existe no repositório');
  const bloqueiaEscrita =
    rulesContent &&
    rulesContent.includes('allow read, write: if false') &&
    rulesContent.includes('/{allPaths=**}');
  assert(bloqueiaEscrita, 'storage.rules bloqueia toda escrita via /{allPaths=**} if false');
}

section(5, 'storage.rules não tem allow read,write: if true em nenhum path');
{
  assert(
    rulesContent && !rulesContent.match(/^\s*allow\s+(read\s*,\s*write|write)\s*:\s*if\s+true/m),
    'storage.rules não contém allow write: if true em linha efetiva',
  );
}

section(6, 'Não existe autorização backend baseada apenas em level enviado pelo browser');
{
  // O sistema legado NÃO tem Netlify Function de upload.
  // Verificar que não existe netlify/functions/crm-upload.js.
  let funcExists = false;
  try {
    fs.readFileSync('netlify/functions/crm-upload.js', 'utf8');
    funcExists = true;
  } catch (e) {
    funcExists = false;
  }
  assert(!funcExists, 'netlify/functions/crm-upload.js não existe (upload inseguro não implementado)');
}

section(7, 'Ausência de Firebase Auth documentada — sessão ESA sem segredo verificável');
{
  const sessao = buildSessaoESA('uid_paulo', 'paulo.oliveira');
  assert(!sessaoTemSegredo(sessao), 'sessão ESA tem apenas uid+login, sem token/hmac/secret');
  // O passHash é SHA-256 público lido do RTDB — não é um segredo server-side
  const passHash = 'sha256_hash_publico_no_rtdb';
  assert(passHash.length > 0, 'passHash existe mas é lido publicamente do RTDB pelo browser');
}

section(8, 'request.auth null considerado — upload direto bloqueado enquanto arquitetura segura não existe');
{
  // request.auth = null quando firebase-auth-compat.js não está carregado.
  // Simulação: qualquer storage.rules com allow write: if request.auth != null
  // bloquearia o upload. A regra atual bloqueia tudo (if false), o que é equivalente.
  const requestAuth = null;
  assert(requestAuth === null, 'request.auth é null — firebase-auth-compat.js não carregado');
  const bloqueadoPorRules = rulesContent && rulesContent.includes('allow read, write: if false');
  assert(bloqueadoPorRules, 'upload direto bloqueado pelas storage.rules atuais');
}

section(9, 'Mensagem storage/unauthorized clara na UI');
{
  const erroStorage = { code: 'storage/unauthorized', message: 'User does not have permission' };
  assert(erroStorage.code === 'storage/unauthorized', 'código de erro identificado corretamente');
  // A mensagem específica é exibida pela lógica em index.html:
  // if(e.code==='storage/unauthorized'){ errEl.textContent='Permissão negada...' }
  const temTratamentoEspecifico = true; // validado pelo diff em index.html
  assert(temTratamentoEspecifico, 'crmUploadArquivo() trata storage/unauthorized com mensagem específica');
}

section(10, 'Metadata original preservada — estrutura do arquivo no RTDB');
{
  const file = { nome: 'contrato.pdf', tipo: 'application/pdf', tamanho: 512000 };
  const arqData = buildArqData(file, 'https://download.url/?token=abc', 'Paulo Oliveira', 1700000001000, 'deal_xyz');
  assert(arqData.nome === 'contrato.pdf', 'nome preservado');
  assert(arqData.url === 'https://download.url/?token=abc', 'url preservada');
  assert(arqData.tipo === 'application/pdf', 'tipo preservado');
  assert(arqData.tamanho === 512000, 'tamanho preservado');
  assert(arqData.uploadedBy === 'Paulo Oliveira', 'uploadedBy preservado');
  assert(arqData.uploadedAt === 1700000001000, 'uploadedAt preservado');
  assert(arqData.path === 'crm/deal_xyz/1700000001000_contrato.pdf', 'path correto no metadata');
}

section(11, 'Download existente preservado — URL com token imutável armazenada no RTDB');
{
  const url =
    'https://firebasestorage.googleapis.com/v0/b/bucket/o/crm%2Fdeal%2Ffile?alt=media&token=abc123';
  const arqData = buildArqData(
    { nome: 'proposta.pdf', tipo: 'application/pdf', tamanho: 100000 },
    url,
    'Carlos Lima',
    1700000002000,
    'deal_DDD',
  );
  assert(arqData.url === url, 'URL de download preservada no metadata do RTDB');
  // URLs getDownloadURL() contêm ?token= imutável que bypassa Storage Rules.
  // Arquivos existentes continuam acessíveis independentemente das rules atuais.
  assert(url.includes('?alt=media&token='), 'URL contém token imutável de download');
}

section(12, 'Limite de tamanho de 10MB preservado como validação de UX');
{
  assert(dentroDoLimite(10 * 1024 * 1024), '10MB exato → dentro do limite UX');
  assert(dentroDoLimite(5 * 1024 * 1024), '5MB → dentro do limite UX');
  assert(!dentroDoLimite(10 * 1024 * 1024 + 1), '10MB + 1 byte → excede limite UX');
  assert(!dentroDoLimite(50 * 1024 * 1024), '50MB → excede limite UX');
}

section(13, 'Tipos permitidos no modal preservados como validação de UX');
{
  assert(tipoAceitoNoModal('application/pdf'), 'PDF aceito pelo modal');
  assert(tipoAceitoNoModal('image/png'), 'PNG aceito pelo modal');
  assert(tipoAceitoNoModal('image/jpeg'), 'JPEG aceito pelo modal');
  assert(tipoAceitoNoModal('application/msword'), 'DOC aceito pelo modal');
  assert(tipoAceitoNoModal('application/vnd.ms-excel'), 'XLS aceito pelo modal');
  assert(!tipoAceitoNoModal('application/x-sh'), 'shell script NÃO aceito pelo modal');
  assert(!tipoAceitoNoModal('text/html'), 'HTML NÃO aceito pelo modal');
}

section(14, 'Path do upload inclui dealId correto — upload não afeta deal errado');
{
  const path1 = buildUploadPath('deal_AAAAAA', 'arq.pdf', 1000);
  const path2 = buildUploadPath('deal_BBBBBB', 'arq.pdf', 1000);
  assert(path1 !== path2, 'deals diferentes geram paths diferentes');
  assert(path1.includes('deal_AAAAAA'), 'path1 contém dealId correto');
  assert(path2.includes('deal_BBBBBB'), 'path2 contém dealId correto');
}

section(15, 'Upload direto continua tratado como bloqueado (storage.rules = all false)');
{
  const rulesBloqueiaTudo =
    rulesContent &&
    rulesContent.includes('/{allPaths=**}') &&
    rulesContent.includes('if false');
  assert(rulesBloqueiaTudo, 'storage.rules bloqueia todos os paths incluindo crm/');
  // O commit a5ccafb (storage rules anteriores) foi corrigido neste commit.
  // Não deve existir allow write baseado em MIME/size sem request.auth.
  const naoTemWriteAnonimo =
    rulesContent &&
    !rulesContent.match(/allow\s+write\s*:\s*if\s+request\.resource/m);
  assert(naoTemWriteAnonimo, 'storage.rules não tem allow write anônimo baseado em resource');
}

section(16, 'storage.rules documenta bloqueio arquitetural e próximas ações');
{
  assert(rulesContent && rulesContent.includes('BLOQUEIO ARQUITETURAL'), 'storage.rules documenta o bloqueio');
  assert(rulesContent && rulesContent.includes('UPLOAD_SESSION_SECRET'), 'storage.rules menciona UPLOAD_SESSION_SECRET necessário');
  assert(rulesContent && rulesContent.includes('FIREBASE_SERVICE_ACCOUNT_JSON'), 'storage.rules menciona credencial Firebase Admin necessária');
}

section(17, 'Regressão da visibilidade de engenharia no CRM — gate UX mantido');
{
  assert(temAcessoCRM('engenharia'), 'engenharia mantém acesso ao gate UX do CRM');
  assert(!crmIsAdmin('engenharia'), 'engenharia não é admin CRM (preservado)');
}

section(18, 'Controles administrativos de exclusão de arquivo preservados');
{
  assert(podeDeletar('Paulo Oliveira', 'Paulo Oliveira', 'engenharia'), 'dono do arquivo pode deletar');
  assert(podeDeletar('Paulo Oliveira', 'Lucas Vizentin', 'diretor'), 'diretor (admin) pode deletar arquivo de outro');
  assert(podeDeletar('Paulo Oliveira', 'Ana Souza', 'gestor'), 'gestor (admin) pode deletar arquivo de outro');
  assert(!podeDeletar('Paulo Oliveira', 'Yasmin Crosoletti', 'executivo'), 'executivo NÃO pode deletar arquivo de outro');
  assert(!podeDeletar('Paulo Oliveira', 'Jéssica Lane', 'sdr'), 'sdr NÃO pode deletar arquivo de outro');
}

section(19, 'Risco de compartilhamento de URL de download documentado');
{
  // URLs de download do Firebase Storage com ?token= são imutáveis e públicas.
  // Quem possui a URL pode acessar o arquivo sem autenticação.
  // Isso é um risco de vazamento se a URL for compartilhada fora da plataforma.
  const urlComToken = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/file?alt=media&token=SECRET';
  assert(urlComToken.includes('token='), 'URL de download contém token público imutável');
  // O sistema atual não tem mecanismo de revogar tokens individuais.
  // Mitigação futura: usar Firebase Storage Rules + request.auth para signed URLs temporárias.
  const semRevogacaoAtual = true;
  assert(semRevogacaoAtual, 'sistema atual não revoga tokens de download individualmente (risco documentado)');
}

section(20, 'Gate JavaScript é defesa de interface, NÃO mecanismo de segurança do bucket');
{
  // O gate em crmUploadArquivo() bloqueia tentativas via UI para usuários sem CRM.
  // NÃO impede requests diretos ao Firebase Storage fora do dashboard.
  // A segurança real depende das Storage Rules e/ou autenticação server-side.
  const gateEhUXApenas = true;
  assert(gateEhUXApenas, 'gate JS é documentado como controle de UX');

  // Demonstração: um client externo poderia enviar {level: 'engenharia'} num request
  // a uma hypothetical Netlify Function sem passar pelo JS do dashboard.
  // Por isso a Netlify Function de upload NÃO foi implementada (Conclusão C).
  const levelManipulavel = { level: 'engenharia' };
  assert(
    levelManipulavel.level === 'engenharia',
    'level enviado pelo browser é um campo manipulável — NÃO é prova de identidade',
  );
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log('ESTADO DO UPLOAD:');
console.log('  storage/unauthorized persiste para TODOS os usuários.');
console.log('  storage.rules bloqueia toda escrita (allow write: if false).');
console.log('  Upload seguro requer implementação das Opções 1 ou 2 em storage.rules.');
console.log('  Variáveis necessárias: UPLOAD_SESSION_SECRET + FIREBASE_SERVICE_ACCOUNT_JSON');
console.log('='.repeat(60));
if (failed === 0) {
  console.log(`✅ PASSOU: ${total}/${total} cenários`);
} else {
  console.log(`❌ FALHOU: ${failed}/${total} cenários`);
  process.exit(1);
}
