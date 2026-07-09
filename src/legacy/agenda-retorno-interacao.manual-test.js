/**
 * ESA OS — Hotfix: agenda-retorno-interacao
 * Suite de testes manuais — 14 cenários obrigatórios
 *
 * Execução: node src/legacy/agenda-retorno-interacao.manual-test.js
 *
 * Verifica que events com type:'retomada' NÃO são contabilizados como
 * Atendimento Realizado (countMeta 'atendimentos' / 'atend_mensal') e
 * que a Interação Comercial é preservada via interacoes entries.
 *
 * Regra comercial:
 *   card "Aguardando retorno" + clique Sucesso → +1 INTERAÇÃO COMERCIAL
 *                                               e NÃO +1 ATENDIMENTO REALIZADO
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
  console.log(`\n[${n}/14] ${title}`);
}

// ── Lógica extraída de index.html (countMeta — blocos 'atendimentos' e 'atend_mensal') ──

/**
 * Replica countMeta para id='atendimentos' conforme implementado após o hotfix.
 * Exclui eventos com type:'retomada'.
 */
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

/**
 * Replica countMeta para id='atend_mensal' conforme implementado após o hotfix.
 * Exclui eventos com type:'retomada'.
 */
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

/**
 * Replica countMeta para id='interacao' conforme index.html.
 * Conta interacoes entries (tipo qualquer) no dia.
 */
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

// ── Cenários ──────────────────────────────────────────────────────────────────

section(1, 'Retomada com resultado=sucesso NÃO conta como atendimento');
{
  const dayEvents = {
    r1: mkRetomadaEv({ resultado: 'sucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, 'retomada sucesso → atendimentos === 0');
}

section(2, 'Visita com resultado=sucesso É contada como atendimento (regressão)');
{
  const dayEvents = {
    v1: mkVisitaEv({ resultado: 'sucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 1, 'visita sucesso → atendimentos === 1');
}

section(3, 'Retomada com resultado=insucesso NÃO conta como atendimento');
{
  const dayEvents = {
    r1: mkRetomadaEv({ resultado: 'insucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, 'retomada insucesso → atendimentos === 0');
}

section(4, 'Retomada sem resultado NÃO conta como atendimento');
{
  const dayEvents = {
    r1: mkRetomadaEv(),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, 'retomada sem resultado → atendimentos === 0');
}

section(5, 'Mix retomada+visita: apenas visita sucesso conta');
{
  const dayEvents = {
    r1: mkRetomadaEv({ resultado: 'sucesso' }),
    v1: mkVisitaEv({ resultado: 'sucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 1, 'mix retomada+visita → atendimentos === 1 (só visita)');
}

section(6, 'Múltiplas retomadas com sucesso: nenhuma conta como atendimento');
{
  const dayEvents = {
    r1: mkRetomadaEv({ id: 'r1', resultado: 'sucesso' }),
    r2: mkRetomadaEv({ id: 'r2', resultado: 'sucesso' }),
    r3: mkRetomadaEv({ id: 'r3', resultado: 'sucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, '3 retomadas com sucesso → atendimentos === 0');
}

section(7, 'Evento CRM com resultado=sucesso É contado como atendimento (regressão)');
{
  const dayEvents = {
    c1: mkCrmEv({ resultado: 'sucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 1, 'crm evento sucesso → atendimentos === 1');
}

section(8, 'Retomada de outro usuário (author diferente) não conta');
{
  const dayEvents = {
    r1: mkRetomadaEv({ author: 'Outro Usuário', resultado: 'sucesso' }),
  };
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, 'retomada de outro usuário → atendimentos === 0 para USER');
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
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, 'retomada como guest → atendimentos === 0');
}

section(10, 'Interação salva por agRegistrarResultado conta em interacao (preservado)');
{
  const interacoes = {
    int_1: { ts: NOW_TS, tipo: 'interacao', autor: USER },
  };
  const count = countInteracao(interacoes);
  assert(count === 1, 'interacoes entry do sucesso → interacao === 1');
}

section(11, 'Sem eventos no dia: atendimentos === 0');
{
  const count = countAtendimentos({}, USER);
  assert(count === 0, 'sem eventos → atendimentos === 0');
}

section(12, 'Evento null/undefined ignorado sem erro');
{
  const dayEvents = { bad: null, undef: undefined, r1: mkRetomadaEv({ resultado: 'sucesso' }) };
  let threw = false;
  try {
    const count = countAtendimentos(dayEvents, USER);
    assert(count === 0, 'eventos inválidos ignorados, retomada excluída → 0');
  } catch (e) {
    threw = true;
  }
  assert(!threw, 'não lança exceção com entradas null/undefined');
}

section(13, 'atend_mensal exclui retomada (fix presente na contagem mensal)');
{
  const todayKey = TODAY;
  const agEvs = {
    [todayKey]: {
      r1: mkRetomadaEv({ resultado: 'sucesso' }),
      v1: mkVisitaEv({ resultado: 'sucesso' }),
    },
  };
  const count = countAtendMensal(agEvs, USER);
  assert(count === 1, 'atend_mensal com retomada+visita → 1 (só visita conta)');
}

section(14, 'Retomada SDR ("Retomar contato") também é type:retomada — excluída');
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
  const count = countAtendimentos(dayEvents, USER);
  assert(count === 0, 'retomada SDR com sucesso → atendimentos === 0');
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ PASSOU: ${total}/${total} cenários`);
} else {
  console.log(`❌ FALHOU: ${failed}/${total} cenários`);
  process.exit(1);
}
