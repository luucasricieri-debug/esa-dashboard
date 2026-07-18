import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, Zap } from 'lucide-react';
import { Card, SectionTitle, Badge, Button } from '../ui';
import { useEsaProvider } from '@/lib/esa/EsaProviderContext';
import type { Alert } from '@/lib/esa/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const meta: Record<Alert['severity'], { label: string; tone: string; ring: string; icon: any }> = {
  critico: {
    label: 'Crítico',
    tone: 'bg-rose-100 text-rose-700',
    ring: 'border-rose-200 bg-rose-50/40',
    icon: AlertTriangle,
  },
  risco: {
    label: 'Risco',
    tone: 'bg-amber-100 text-amber-800',
    ring: 'border-amber-200 bg-amber-50/40',
    icon: AlertCircle,
  },
  atencao: {
    label: 'Atenção',
    tone: 'bg-sky-100 text-sky-700',
    ring: 'border-sky-200 bg-sky-50/40',
    icon: Zap,
  },
  info: {
    label: 'Informação',
    tone: 'bg-slate-100 text-slate-700',
    ring: 'border-slate-200 bg-white',
    icon: Info,
  },
};

export function AlertsView() {
  const provider = useEsaProvider();
  const alerts = provider.listAlerts();
  const [filter, setFilter] = useState<Alert['severity'] | 'all'>('all');
  const [selected, setSelected] = useState<Alert | null>(null);
  const rows = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  const counts = {
    critico: alerts.filter((a) => a.severity === 'critico').length,
    risco: alerts.filter((a) => a.severity === 'risco').length,
    atencao: alerts.filter((a) => a.severity === 'atencao').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(counts) as Alert['severity'][]).map((k) => {
          const m = meta[k];
          const Icon = m.icon;
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(active ? 'all' : k)}
              className={cn(
                'rounded-xl border bg-white text-left p-4 transition-all',
                active ? 'border-emerald-500 shadow-sm' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full', m.tone)}>
                  <Icon className="h-3 w-3" /> {m.label}
                </span>
                <span className="text-2xl font-semibold text-slate-900 tabular-nums">{counts[k]}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {active ? 'Filtrando por esta severidade' : 'Clique para filtrar'}
              </p>
            </button>
          );
        })}
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Central de alertas"
          desc="Eventos operacionais que requerem atenção"
          right={
            filter !== 'all' && (
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Limpar filtro
              </Button>
            )
          }
        />
        <div className="space-y-2.5">
          {rows.map((a) => {
            const m = meta[a.severity];
            const Icon = m.icon;
            return (
              <div key={a.id} className={cn('border rounded-xl px-4 py-3 flex items-start gap-3', m.ring)}>
                <div className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0', m.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{a.code}</Badge>
                    <span className="text-sm font-medium text-slate-900">{a.message}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Unidade: <b className="text-slate-800">{a.unit}</b></span>
                    <span>Mês: <b className="text-slate-800">{a.month}</b></span>
                    <span>Ação: <span className="text-emerald-700">{a.action}</span></span>
                  </div>
                </div>
                <Button variant="soft" size="sm" onClick={() => setSelected(a)}>
                  Analisar
                </Button>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500">Nenhum alerta nesta severidade</div>
          )}
        </div>
      </Card>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge tone="neutral">{selected.code}</Badge>
                  <span className="uppercase text-xs">{selected.severity}</span>
                </SheetTitle>
                <SheetDescription>Mês {selected.month}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                <div className="text-sm font-medium text-slate-900">{selected.message}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Unidade</div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{selected.unit}</div>
                  </div>
                  <div className="border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Mês</div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{selected.month}</div>
                  </div>
                </div>
                <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Ação recomendada</div>
                  <div className="text-sm text-emerald-900 mt-1">{selected.action}</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
