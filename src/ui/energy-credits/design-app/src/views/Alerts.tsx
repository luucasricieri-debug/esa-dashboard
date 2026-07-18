import { useState } from 'react';
import { AlertTriangle, Info, XCircle, Bell, CheckCircle, X } from 'lucide-react';
import { SectionTitle, Button, Drawer, EmptyState } from '@/components/ui/index';
import { demoProvider } from '@/lib/demo';
import type { Alert } from '@/lib/demo';

type SeverityFilter = 'all' | 'critico' | 'risco' | 'atencao' | 'info';

function severityIcon(severity: Alert['severity']) {
  switch (severity) {
    case 'critico': return <XCircle className="h-4 w-4 text-rose-600" />;
    case 'risco': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'atencao': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'info': return <Info className="h-4 w-4 text-sky-500" />;
  }
}

function severityLabel(severity: Alert['severity']) {
  const labels: Record<Alert['severity'], string> = {
    critico: 'Crítico',
    risco: 'Risco',
    atencao: 'Atenção',
    info: 'Informativo',
  };
  return labels[severity];
}

function severityColors(severity: Alert['severity']) {
  switch (severity) {
    case 'critico': return { badge: 'bg-rose-100 text-rose-800 border-rose-200', border: 'border-l-rose-500' };
    case 'risco': return { badge: 'bg-orange-100 text-orange-800 border-orange-200', border: 'border-l-orange-400' };
    case 'atencao': return { badge: 'bg-amber-100 text-amber-800 border-amber-200', border: 'border-l-amber-400' };
    case 'info': return { badge: 'bg-sky-100 text-sky-800 border-sky-200', border: 'border-l-sky-400' };
  }
}

function AlertCard({ alert, onClick }: { alert: Alert; onClick: () => void }) {
  const colors = severityColors(alert.severity);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border border-slate-200 border-l-4 ${colors.border} rounded-xl p-4 hover:shadow-sm transition-all`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{severityIcon(alert.severity)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-900 text-sm">{alert.message}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{alert.code}</div>
            </div>
            <span className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">{alert.month}</span>
          </div>
          {alert.unit && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full text-[11px] text-slate-600">
              <Bell className="h-3 w-3" />
              {alert.unit}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function AlertDetail({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const [resolved, setResolved] = useState(false);
  const colors = severityColors(alert.severity);

  return (
    <div className="space-y-5">
      {/* Severity badge */}
      <div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${colors.badge}`}>
          {severityIcon(alert.severity)}
          {severityLabel(alert.severity)}
        </span>
      </div>

      {/* Code */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">Código do alerta</div>
        <div className="font-mono text-sm bg-slate-100 rounded-lg px-3 py-2 text-slate-700">{alert.code}</div>
      </div>

      {/* Message */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">Descrição</div>
        <p className="text-sm text-slate-700 leading-relaxed">{alert.message}</p>
      </div>

      {/* Affected unit */}
      {alert.unit && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">Unidade afetada</div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-800">
            <Bell className="h-3.5 w-3.5 text-slate-500" />
            {alert.unit}
          </div>
        </div>
      )}

      {/* Month */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">Mês de referência</div>
        <div className="text-sm text-slate-700">{alert.month}</div>
      </div>

      {/* Recommended action */}
      {alert.action && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1.5">Ação recomendada</div>
          <p className="text-sm text-emerald-900 leading-relaxed">{alert.action}</p>
        </div>
      )}

      {/* Resolution */}
      {resolved ? (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Alerta marcado como resolvido.
        </div>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1 justify-center" onClick={() => setResolved(true)}>
            <CheckCircle className="h-4 w-4" /> Marcar como resolvido
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function Alerts({ onNavigate }: { onNavigate?: (v: string) => void }) {
  void onNavigate; // available for future drill-down navigation
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const allAlerts = demoProvider.listAlerts();

  const filtered = filter === 'all' ? allAlerts : allAlerts.filter(a => a.severity === filter);

  const counts: Record<SeverityFilter, number> = {
    all: allAlerts.length,
    critico: allAlerts.filter(a => a.severity === 'critico').length,
    risco: allAlerts.filter(a => a.severity === 'risco').length,
    atencao: allAlerts.filter(a => a.severity === 'atencao').length,
    info: allAlerts.filter(a => a.severity === 'info').length,
  };

  const groups: { key: Alert['severity']; label: string }[] = [
    { key: 'critico', label: 'Críticos' },
    { key: 'risco', label: 'Riscos' },
    { key: 'atencao', label: 'Atenção' },
    { key: 'info', label: 'Informativos' },
  ];

  const filterButtons: { key: SeverityFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'critico', label: 'Críticos' },
    { key: 'risco', label: 'Riscos' },
    { key: 'atencao', label: 'Atenção' },
    { key: 'info', label: 'Informativos' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          {filterButtons.map(f => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  isActive
                    ? f.key === 'critico'
                      ? 'bg-rose-100 border-rose-300 text-rose-800'
                      : f.key === 'risco'
                      ? 'bg-orange-100 border-orange-300 text-orange-800'
                      : f.key === 'atencao'
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : f.key === 'info'
                      ? 'bg-sky-100 border-sky-300 text-sky-800'
                      : 'bg-slate-800 border-slate-800 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {f.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${isActive ? 'bg-white/30' : 'bg-slate-100 text-slate-600'}`}>
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <EmptyState
          icon={<CheckCircle className="h-8 w-8 text-emerald-500" />}
          title="Nenhum alerta encontrado"
          desc="Todos os alertas estão resolvidos ou os filtros não retornaram resultados."
        />
      )}

      {/* Alert groups */}
      {groups.map(g => {
        const items = filtered.filter(a => a.severity === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key}>
            <SectionTitle
              title={g.label}
              desc={`${items.length} ${items.length === 1 ? 'alerta' : 'alertas'}`}
            />
            <div className="space-y-2">
              {items.map(a => (
                <AlertCard key={a.id} alert={a} onClick={() => setSelectedAlert(a)} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Detail drawer */}
      <Drawer
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title={selectedAlert?.code ?? ''}
        desc={selectedAlert?.unit ?? ''}
      >
        {selectedAlert && (
          <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
        )}
      </Drawer>
    </div>
  );
}
