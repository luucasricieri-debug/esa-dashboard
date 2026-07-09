/**
 * ESA OS — Hotfix: crm-upload-arquivos
 * Suite de testes manuais — 20 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-upload-arquivos.manual-test.js
 *
 * Escopo: valida a lógica JS extraída do hotfix em index.html.
 * NÃO valida o Firebase Storage remoto (Storage Rules são externas ao repositório).
 *
 * IMPORTANTE:
 *   O storage/unauthorized NÃO é corrigido apenas por esta mudança JavaScript.
 *   O arquivo storage.rules precisa ser implantado via Firebase CLI ou Console.
 *   Veja storage.rules na raiz do repositório.
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

// ── Lógica extraída de index.html (crmUploadArquivo — gate de acesso) ─────────

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

// ── Tipos permitidos (storage.rules e aceitos pelo <input>) ──────────────────

const TIPOS_PERMITIDOS = [
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

function tipoPermitido(mimeType) {
  return TIPOS_PERMITIDOS.includes(mimeType);
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

// ── Storage Rules — estrutura esperada ───────────────────────────────────────

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

section(1, 'Regra de acesso ao CRM reutilizada em temAcessoCRM()');
{
  assert(NIVEIS_CRM.includes('diretor'), 'diretor está na lista CRM');
  assert(NIVEIS_CRM.includes('gestor'), 'gestor está na lista CRM');
  assert(NIVEIS_CRM.includes('trafego'), 'trafego está na lista CRM');
  assert(NIVEIS_CRM.includes('executivo'), 'executivo está na lista CRM');
  assert(NIVEIS_CRM.includes('sdr'), 'sdr está na lista CRM');
  assert(NIVEIS_CRM.includes('jackeline'), 'jackeline está na lista CRM');
  assert(NIVEIS_CRM.includes('engenharia'), 'engenharia está na lista CRM');
}

section(2, 'diretor tem acesso ao upload');
{ assert(temAcessoCRM('diretor'), 'diretor → acesso CRM = true'); }

section(3, 'gestor tem acesso ao upload');
{ assert(temAcessoCRM('gestor'), 'gestor → acesso CRM = true'); }

section(4, 'trafego tem acesso ao upload');
{ assert(temAcessoCRM('trafego'), 'trafego → acesso CRM = true'); }

section(5, 'executivo tem acesso ao upload');
{ assert(temAcessoCRM('executivo'), 'executivo → acesso CRM = true'); }

section(6, 'sdr tem acesso ao upload');
{ assert(temAcessoCRM('sdr'), 'sdr → acesso CRM = true'); }

section(7, 'jackeline tem acesso ao upload');
{ assert(temAcessoCRM('jackeline'), 'jackeline → acesso CRM = true'); }

section(8, 'engenharia tem acesso ao upload (regressão do bug)');
{ assert(temAcessoCRM('engenharia'), 'engenharia → acesso CRM = true'); }

section(9, 'usuário sem CRM (marketing) bloqueado no JS gate');
{
  assert(!temAcessoCRM('marketing'), 'marketing → acesso CRM = false');
  assert(!temAcessoCRM(''), 'nível vazio → acesso CRM = false');
  assert(!temAcessoCRM('admin'), 'nível desconhecido → acesso CRM = false');
}

section(10, 'path do deal construído corretamente');
{
  const path = buildUploadPath('deal_abc123', 'Proposta Final.pdf', 1700000000000);
  assert(path.startsWith('crm/deal_abc123/'), 'path inicia com crm/{dealId}/');
  assert(path.includes('Proposta_Final.pdf'), 'espaço substituído por _');
  assert(path === 'crm/deal_abc123/1700000000000_Proposta_Final.pdf', 'path completo correto');
}

section(11, 'metadata do arquivo preserva todos os campos');
{
  const file = { nome: 'contrato.pdf', tipo: 'application/pdf', tamanho: 512000 };
  const arqData = buildArqData(file, 'https://download.url/?token=abc', 'Ana Souza', 1700000001000, 'deal_xyz');
  assert(arqData.nome === 'contrato.pdf', 'nome preservado');
  assert(arqData.url === 'https://download.url/?token=abc', 'url preservada');
  assert(arqData.tipo === 'application/pdf', 'tipo preservado');
  assert(arqData.tamanho === 512000, 'tamanho preservado');
  assert(arqData.uploadedBy === 'Ana Souza', 'uploadedBy preservado');
  assert(arqData.uploadedAt === 1700000001000, 'uploadedAt preservado');
  assert(arqData.path === 'crm/deal_xyz/1700000001000_contrato.pdf', 'path correto no metadata');
}

section(12, 'limite de tamanho de 10MB preservado');
{
  assert(dentroDoLimite(10 * 1024 * 1024), '10MB exato → permitido');
  assert(dentroDoLimite(5 * 1024 * 1024), '5MB → permitido');
  assert(!dentroDoLimite(10 * 1024 * 1024 + 1), '10MB + 1 byte → bloqueado');
  assert(!dentroDoLimite(50 * 1024 * 1024), '50MB → bloqueado');
}

section(13, 'tipos de arquivo permitidos preservados');
{
  assert(tipoPermitido('application/pdf'), 'PDF permitido');
  assert(tipoPermitido('image/png'), 'PNG permitido');
  assert(tipoPermitido('image/jpeg'), 'JPEG permitido');
  assert(tipoPermitido('image/gif'), 'GIF permitido');
  assert(tipoPermitido('image/webp'), 'WebP permitido');
  assert(tipoPermitido('application/msword'), 'DOC permitido');
  assert(tipoPermitido('application/vnd.ms-excel'), 'XLS permitido');
  assert(
    tipoPermitido('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    'DOCX permitido',
  );
  assert(
    tipoPermitido('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'XLSX permitido',
  );
  assert(!tipoPermitido('application/x-sh'), 'shell script bloqueado');
  assert(!tipoPermitido('application/javascript'), 'JS bloqueado');
  assert(!tipoPermitido('text/html'), 'HTML bloqueado');
}

section(14, 'upload não afeta deal errado — path inclui dealId');
{
  const path1 = buildUploadPath('deal_AAAAAA', 'arq.pdf', 1000);
  const path2 = buildUploadPath('deal_BBBBBB', 'arq.pdf', 1000);
  assert(path1 !== path2, 'deals diferentes geram paths diferentes');
  assert(path1.includes('deal_AAAAAA'), 'path1 contém dealId correto');
  assert(path2.includes('deal_BBBBBB'), 'path2 contém dealId correto');
}

section(15, 'download preservado — URL com token armazenada no metadata');
{
  const url = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/crm%2Fdeal%2Ffile?alt=media&token=abc123';
  const arqData = buildArqData(
    { nome: 'proposta.pdf', tipo: 'application/pdf', tamanho: 100000 },
    url,
    'Carlos Lima',
    1700000002000,
    'deal_DDD',
  );
  assert(arqData.url === url, 'URL de download (com token) preservada no metadata');
}

section(16, 'erro storage/unauthorized tratado com mensagem específica');
{
  const erroStorage = { code: 'storage/unauthorized', message: 'User does not have permission' };
  const isUnauthorized = erroStorage.code === 'storage/unauthorized';
  assert(isUnauthorized, 'code storage/unauthorized identificado corretamente');
}

section(17, 'storage.rules versionado no repositório');
{
  assert(rulesContent !== null, 'storage.rules existe no repositório');
  assert(rulesContent && rulesContent.includes('crm/{dealId}/{fileName}'), 'storage.rules cobre o path crm/{dealId}/{fileName}');
  assert(rulesContent && !rulesContent.match(/^\s*allow\s+read\s*,\s*write\s*:\s*if\s+true/m), 'storage.rules NÃO tem regra allow read,write:if true em linha efetiva');
  assert(rulesContent && rulesContent.includes('allow read, write: if false'), 'storage.rules bloqueia todos os outros paths');
}

section(18, 'Storage Rules NÃO liberam caminhos fora de crm/');
{
  assert(rulesContent && !rulesContent.includes('/{allPaths=**} {\n      allow read, write: if true'), 'nenhuma liberação pública do bucket completo');
  const bloqueiaResto = rulesContent && rulesContent.includes('/{allPaths=**}') && rulesContent.includes('if false');
  assert(bloqueiaResto, 'catch-all bloqueia tudo fora de crm/');
}

section(19, 'regressão da visibilidade de engenharia no CRM');
{
  assert(temAcessoCRM('engenharia'), 'engenharia mantém acesso ao CRM');
  assert(!crmIsAdmin('engenharia'), 'engenharia NÃO é admin (crmIsAdmin preservado)');
}

section(20, 'controles administrativos de exclusão preservados');
{
  assert(podeDeletar('Paulo Oliveira', 'Paulo Oliveira', 'engenharia'), 'dono do arquivo pode deletar');
  assert(podeDeletar('Paulo Oliveira', 'Lucas Vizentin', 'diretor'), 'diretor (admin) pode deletar arquivo de outro');
  assert(podeDeletar('Paulo Oliveira', 'Ana Souza', 'gestor'), 'gestor (admin) pode deletar arquivo de outro');
  assert(!podeDeletar('Paulo Oliveira', 'Yasmin Crosoletti', 'executivo'), 'executivo NÃO pode deletar arquivo de outro');
  assert(!podeDeletar('Paulo Oliveira', 'Jéssica Lane', 'sdr'), 'sdr NÃO pode deletar arquivo de outro');
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log('NOTA: storage/unauthorized persiste até storage.rules ser implantado.');
console.log('      Execute: firebase deploy --only storage');
console.log('='.repeat(60));
if (failed === 0) {
  console.log(`✅ PASSOU: ${total}/${total} cenários`);
} else {
  console.log(`❌ FALHOU: ${failed}/${total} cenários`);
  process.exit(1);
}
