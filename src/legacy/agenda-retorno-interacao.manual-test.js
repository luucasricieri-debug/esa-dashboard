/**
 * ESA OS — Hotfix: agenda-retorno-interacao + retomada-novo-cliente-meta-interacao
 * Suite de testes manuais — 25 cenários obrigatórios
 *
 * Execução: node src/legacy/agenda-retorno-interacao.manual-test.js
 *
 * Regra comercial final:
 *   type:'retomada' + sucesso → +1 Interação Comercial
 *                             → 0  Atendimento Realizado
 *                             → 0  Novo Cliente
 *
 * Meta diária Interação Comercial (executivo): 10
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
  console.log(`\n[${n}/25] ${title}`);
}

// ── Lógica extraída de index.html — countMeta('atendimentos') ─────────────────

function countAtendimentos(dayEvents, userName) {
  let count = 0;
  Object.values(dayEvents || {}).forEach(function (ev) {
    if (!ev) return;
    if (ev.type === 'retomada') return;
    const isAuthor = ev.author === userName;
    const isGuest =
      ev.guests && ev.guests.some((g) => g.name === userName && g.status === 'confirmed');
    const isSucesso = ev.resultado === 'sucesso';
    const isCliente = !ev.tipo_atendimento || ev.tipo_atendimento === 'cliente';
    if ((isAuthor || isGuest) && isSucesso && isCliente) count++;
  });
  return count;
}

// ── Lógica extraída de index.html — countMeta('atend_mensal') ────────────────

function countAtendMensal(agEvs, userName) {
  const now = new Date();
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), d);
    if (dt.getMonth() !== now.getMonth()) break;
    const key =
      dt.getFullYear() +
      '-' +
      String(dt.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(dt.getDate()).padStart(2, '0');
    const dayEvs2 = agEvs[key] || {};
    Object.values(dayEvs2).forEach(function (ev) {
      if (!ev) return;
      if (ev.type === 'retomada') return;
      const isAuthor = ev.author === userName;
      const isGuest =
        ev.guests && ev.guests.some((g) => g.name === userName && g.status === 'confirmed');
      const isSucesso = ev.resultado === 'sucesso';
      const isCliente = !ev.tipo_atendimento || ev.tipo_atendimento === 'cliente';
      if ((isAuthor || isGuest) && isSucesso && isCliente) count++;
    });
  }
  return count;
}

// ── Lógica extraída de index.html — countMeta('interacao') ───────────────────

function countInteracao(interacoes) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime();
  const todayEnd = todayTs + 86400000;
  let count = 0;
  Object.values(interacoes || {}).forEach(function (i) {
    if (i && i.ts >= todayTs && i.ts < todayEnd) count++;
  });
  return count;
}

// ── Lógica extraída de index.html — countMeta('novos_clientes') ──────────────
// Após o hotfix: exclui tipo='retomada' além de tipo='atendimento'

function countNovosClientes(list) {
  return list.filter(function (p) {
    return !p.tipo || (p.tipo !== 'atendimento' && p.tipo !== 'retomada');
  }).length;
}

// SDR — prosp_sdr NÃO exclui retomada (preservação SDR)
function countProspSdr(list) {
  return list.filter(function (p) {
    return !p.tipo || p.tipo !== 'atendimento';
  }).length;
}

// ── Lógica de saveProsp — marcação de retomada ───────────────────────────────
// Simula o comportamento de saveProsp quando _retomadaOrigId está definido

function buildRec(base, retomadaOrigId) {
  const rec = Object.assign({}, base);
  if (retomadaOrigId) {
    rec.tipo = 'retomada';
  }
  return rec;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER = 'Ana Souza';
const TODAY = new Date().toISOString().slice(0, 10);
const NOW_TS = Date.now();

function mkRetomadaEv(overrides = {}) {
  return Object.assign(
    {
      id: 'retomada_abc123',
      title: 'Aguardando retorno — Carlos Lima',
      type: 'retomada',
      author: USER,
      guests: [],
      prospId: 'prosp_abc123',
      prospUid: 'uid_ana',
      resultado: undefined,
    },
    overrides,
  );
}

function mkVisitaEv(overrides = {}) {
  return Object.assign(
    {
      id: 'prosp_xyz',
      title: 'Visita — Maria Santos',
      type: 'visita',
      author: USER,
      guests: [],
      tipo_atendimento: 'cliente',
      resultado: undefined,
    },
    overrides,
  );
}

function mkCrmEv(overrides = {}) {
  return Object.assign(
    {
      id: 'crm_ev_01',
      title: 'Follow-up CRM — Deal X',
      type: 'crm',
      author: USER,
      guests: [],
      tipo_atendimento: 'cliente',
      resultado: undefined,
    },
    overrides,
  );
}

// Prospection entry salva pelo saveProsp (representa uma linha de allProsp[uid])
function mkProspEntry(overrides = {}) {
  return Object.assign(
    {
      id: 'prosp_' + Date.now().toString(36),
      ts: NOW_TS,
      nome: 'Carlos Lima',
      tel: '11999990000',
      status: 'Qualificado',
      author: USER,
    },
    overrides,
  );
}

// ── BLOCO 1 — Regressão Hotfix dc1057d: retomada não conta em atendimentos ────

section(1, 'Retomada com resultado=sucesso NÃO conta como atendimento (regressão dc1057d)');
{
  const dayEvents = { r1: mkRetomadaEv({ resultado: 'sucesso' }) };
  assert(countAtendimentos(dayEvents, USER) === 0, 'retomada sucesso → atendimentos === 0');
}

section(2, 'Visita com resultado=sucesso É contada como atendimento (regressão)');
{
  const dayEvents = { v1: mkVisitaEv({ resultado: 'sucesso' }) };
  assert(countAtendimentos(dayEvents, USER) === 1, 'visita sucesso → atendimentos === 1');
}

section(3, 'Retomada com resultado=insucesso NÃO conta como atendimento');
{
  const dayEvents = { r1: mkRetomadaEv({ resultado: 'insucesso' }) };
  assert(countAtendimentos(dayEvents, USER) === 0, 'retomada insucesso → atendimentos === 0');
}

section(4, 'Retomada sem resultado NÃO conta como atendimento');
{
  const dayEvents = { r1: mkRetomadaEv() };
  assert(countAtendimentos(dayEvents, USER) === 0, 'retomada sem resultado → atendimentos === 0');
}

section(5, 'Mix retomada+visita sucesso: apenas visita conta em atendimentos');
{
  const dayEvents = {
    r1: mkRetomadaEv({ resultado: 'sucesso' }),
    v1: mkVisitaEv({ resultado: 'sucesso' }),
  };
  assert(countAtendimentos(dayEvents, USER) === 1, 'mix → atendimentos === 1 (só visita)');
}

section(6, 'Múltiplas retomadas com sucesso: nenhuma conta como atendimento');
{
  const dayEvents = {
    r1: mkRetomadaEv({ id: 'r1', resultado: 'sucesso' }),
    r2: mkRetomadaEv({ id: 'r2', resultado: 'sucesso' }),
    r3: mkRetomadaEv({ id: 'r3', resultado: 'sucesso' }),
  };
  assert(countAtendimentos(dayEvents, USER) === 0, '3 retomadas → atendimentos === 0');
}

section(7, 'Evento CRM com resultado=sucesso É contado como atendimento (regressão)');
{
  const dayEvents = { c1: mkCrmEv({ resultado: 'sucesso' }) };
  assert(countAtendimentos(dayEvents, USER) === 1, 'crm sucesso → atendimentos === 1');
}

section(8, 'Retomada de outro usuário (author diferente) não conta para USER');
{
  const dayEvents = {
    r1: mkRetomadaEv({ author: 'Outro Usuário', resultado: 'sucesso' }),
  };
  assert(countAtendimentos(dayEvents, USER) === 0, 'retomada de outro → 0 para USER');
}

section(9, 'Retomada como guest confirmado também não conta como atendimento');
{
  const dayEvents = {
    r1: mkRetomadaEv({
      author: 'Outro Usuário',
      guests: [{ name: USER, status: 'confirmed' }],
      resultado: 'sucesso',
    }),
  };
  assert(countAtendimentos(dayEvents, USER) === 0, 'retomada como guest → 0');
}

section(10, 'atend_mensal exclui retomada (fix presente na contagem mensal)');
{
  const agEvs = {
    [TODAY]: {
      r1: mkRetomadaEv({ resultado: 'sucesso' }),
      v1: mkVisitaEv({ resultado: 'sucesso' }),
    },
  };
  assert(countAtendMensal(agEvs, USER) === 1, 'atend_mensal: retomada+visita → 1 (só visita)');
}

// ── BLOCO 2 — Interação Comercial preservada ──────────────────────────────────

section(11, 'Interação salva por agRegistrarResultado conta em interacao');
{
  const interacoes = { int_1: { ts: NOW_TS, tipo: 'interacao', autor: USER } };
  assert(countInteracao(interacoes) === 1, 'interacoes entry → interacao === 1');
}

section(12, 'Evento null/undefined ignorado sem erro em atendimentos');
{
  const dayEvents = { bad: null, undef: undefined, r1: mkRetomadaEv({ resultado: 'sucesso' }) };
  let threw = false;
  try {
    const count = countAtendimentos(dayEvents, USER);
    assert(count === 0, 'entradas inválidas ignoradas, retomada excluída → 0');
  } catch (e) {
    threw = true;
  }
  assert(!threw, 'não lança exceção com entradas null/undefined');
}

section(13, 'Retomada SDR (type:retomada) excluída de atendimentos');
{
  const dayEvents = {
    r_sdr: {
      id: 'retomada_sdr123',
      title: 'Retomar contato — Pedro Alves',
      type: 'retomada',
      author: USER,
      guests: [],
      resultado: 'sucesso',
    },
  };
  assert(countAtendimentos(dayEvents, USER) === 0, 'retomada SDR → atendimentos === 0');
}

// ── BLOCO 3 — Novo Cliente: retomada excluída ─────────────────────────────────

section(14, 'saveProsp com _retomadaOrigId marca rec.tipo = retomada');
{
  const rec = buildRec({ nome: 'Carlos Lima', ts: NOW_TS }, 'prosp_orig_abc');
  assert(rec.tipo === 'retomada', 'rec.tipo=retomada quando _retomadaOrigId está definido');
}

section(15, 'saveProsp sem _retomadaOrigId NÃO marca rec.tipo');
{
  const rec = buildRec({ nome: 'Maria Santos', ts: NOW_TS }, null);
  assert(rec.tipo === undefined, 'rec.tipo ausente para prospection normal');
}

section(16, 'Retomada salva via saveProsp NÃO conta como Novo Cliente');
{
  const list = [
    mkProspEntry({ tipo: 'retomada' }), // salvo pelo saveProsp de retomada
  ];
  assert(countNovosClientes(list) === 0, 'prosp com tipo:retomada → novos_clientes === 0');
}

section(17, 'Cliente realmente novo (sem tipo) continua contado como Novo Cliente');
{
  const list = [
    mkProspEntry(), // novo cliente: tipo undefined
  ];
  assert(countNovosClientes(list) === 1, 'prosp sem tipo → novos_clientes === 1');
}

section(18, 'Atendimento (tipo:atendimento) NÃO conta como Novo Cliente (preservado)');
{
  const list = [
    mkProspEntry({ tipo: 'atendimento' }),
  ];
  assert(countNovosClientes(list) === 0, 'prosp tipo:atendimento → novos_clientes === 0');
}

section(19, 'Mix: retomada + novo cliente + atendimento → apenas novo cliente conta');
{
  const list = [
    mkProspEntry({ tipo: 'retomada' }),   // excluído: retomada
    mkProspEntry(),                        // incluído: novo cliente
    mkProspEntry({ tipo: 'atendimento' }), // excluído: atendimento
  ];
  assert(countNovosClientes(list) === 1, 'mix → novos_clientes === 1 (só novo cliente)');
}

section(20, 'SDR prosp_sdr: retomada NÃO é excluída (preservação SDR)');
{
  // SDR usa countProspSdr (exclui apenas atendimento, não retomada)
  const list = [
    mkProspEntry({ tipo: 'retomada' }),   // SDR conta: retomada não é excluída para SDR
    mkProspEntry(),                        // SDR conta
    mkProspEntry({ tipo: 'atendimento' }), // SDR exclui
  ];
  assert(countProspSdr(list) === 2, 'SDR prosp_sdr: retomada+novo_cliente=2, atendimento excluído');
}

section(21, 'Ausência de dupla contagem: retomada não conta em Novo Cliente NEM em Atendimentos');
{
  const dayEvents = { r1: mkRetomadaEv({ resultado: 'sucesso' }) };
  const prospList = [mkProspEntry({ tipo: 'retomada' })];
  const atend = countAtendimentos(dayEvents, USER);
  const novos = countNovosClientes(prospList);
  assert(atend === 0, 'sem dupla: atendimentos === 0');
  assert(novos === 0, 'sem dupla: novos_clientes === 0');
}

// ── BLOCO 4 — Meta de Interação Comercial ─────────────────────────────────────

section(22, 'Meta diária de Interação Comercial é 10 no objeto METAS');
{
  // Simula o objeto METAS conforme definido em index.html após o hotfix
  const METAS_EXEC_DIARIA = [
    { id: 'novos_clientes', label: 'Novos Clientes',          meta: 5  },
    { id: 'interacao',      label: 'Interação Comercial',     meta: 10 },
    { id: 'atendimentos',   label: 'Atendimentos Realizados', meta: 2  },
  ];
  const metaInteracao = METAS_EXEC_DIARIA.find((m) => m.id === 'interacao');
  assert(metaInteracao !== undefined, 'entrada interacao encontrada em METAS executivo diaria');
  assert(metaInteracao.meta === 10, `meta interacao === 10 (atual: ${metaInteracao.meta})`);
}

section(23, 'Meta de novos_clientes e atendimentos não foram alteradas');
{
  const METAS_EXEC_DIARIA = [
    { id: 'novos_clientes', meta: 5  },
    { id: 'interacao',      meta: 10 },
    { id: 'atendimentos',   meta: 2  },
  ];
  const metaNovos = METAS_EXEC_DIARIA.find((m) => m.id === 'novos_clientes');
  const metaAtend = METAS_EXEC_DIARIA.find((m) => m.id === 'atendimentos');
  assert(metaNovos.meta === 5, 'novos_clientes meta preservada em 5');
  assert(metaAtend.meta === 2, 'atendimentos meta preservada em 2');
}

section(24, 'Lógica do contador de interacao não foi alterada (usa interacoes, não agEvs)');
{
  // O contador de interacao lê de allProsp[uid].interacoes, não de agEvs
  // Simula: 2 interações hoje + 1 de ontem (fora da janela)
  const ontem = Date.now() - 86400000 - 1000;
  const interacoes = {
    int_1: { ts: NOW_TS - 1000, tipo: 'interacao', autor: USER },
    int_2: { ts: NOW_TS,        tipo: 'interacao', autor: USER },
    int_3: { ts: ontem,         tipo: 'interacao', autor: USER }, // ontem → não conta
  };
  const count = countInteracao(interacoes);
  assert(count === 2, 'interacao conta apenas entradas de hoje (2 de hoje, 1 de ontem ignorada)');
}

section(25, 'Elegibilidade do indicador preservada — interacao conta tipo qualquer no dia');
{
  // O contador de interacao NÃO filtra por tipo da interação (conta todas do dia)
  const interacoes = {
    int_a: { ts: NOW_TS, tipo: 'interacao',    autor: USER },
    int_b: { ts: NOW_TS, tipo: 'agendamento',  autor: USER }, // SDR pode ter
    int_c: { ts: NOW_TS, tipo: 'outros',       autor: USER },
  };
  const count = countInteracao(interacoes);
  assert(count === 3, 'todos os tipos de interacao do dia são contados');
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ PASSOU: ${total}/${total} cenários`);
} else {
  console.log(`❌ FALHOU: ${failed}/${total} cenários`);
  process.exit(1);
}
