import { useEffect, useState, type ReactNode } from 'react';
import { onNavigate, type EsaView } from '@/lib/esa/nav';
import {
  LayoutDashboard, Sun, Building2, Calculator, Upload,
  FileText, Wallet, Bell, Zap, Search, Menu, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dashboard } from './views/Dashboard';
import { GeneratingUnitsView } from './views/GeneratingUnits';
import { BeneficiaryUnitsView } from './views/BeneficiaryUnits';
import { MonthlySettlement } from './views/MonthlySettlement';
import { CsvImport } from './views/CsvImport';
import { Reports } from './views/Reports';
import { Financial } from './views/Financial';
import { AlertsView } from './views/Alerts';

type ViewKey = 'dashboard' | 'ug' | 'ub' | 'apuracao' | 'csv' | 'relatorios' | 'financeiro' | 'alertas';

const navItems: { key: ViewKey; label: string; icon: typeof LayoutDashboard; hint?: string }[] = [
  { key: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'ug', label: 'Unidades Geradoras', icon: Sun },
  { key: 'ub', label: 'Unidades Beneficiárias', icon: Building2 },
  { key: 'apuracao', label: 'Apuração Mensal', icon: Calculator, hint: 'Novo' },
  { key: 'csv', label: 'Importação CSV', icon: Upload },
  { key: 'relatorios', label: 'Relatórios', icon: FileText },
  { key: 'financeiro', label: 'Financeiro', icon: Wallet },
  { key: 'alertas', label: 'Alertas', icon: Bell, hint: '3' },
];

const titles: Record<ViewKey, { title: string; sub: string }> = {
  dashboard: { title: 'Visão Geral', sub: 'Panorama executivo da operação de créditos de energia' },
  ug: { title: 'Unidades Geradoras', sub: 'Gestão das usinas e proprietários' },
  ub: { title: 'Unidades Beneficiárias', sub: 'Clientes que recebem os créditos' },
  apuracao: { title: 'Apuração Mensal', sub: 'Cálculo operacional do ciclo mensal' },
  csv: { title: 'Importação CSV', sub: 'Cargas em massa de dados operacionais' },
  relatorios: { title: 'Relatórios', sub: 'Documentos mensais e executivos' },
  financeiro: { title: 'Financeiro', sub: 'Receita, repasses e inadimplência' },
  alertas: { title: 'Alertas', sub: 'Central operacional de riscos' },
};

function SidebarBody({
  view, setView, collapsed, onNav,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  collapsed: boolean;
  onNav?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className={cn('flex items-center gap-2.5 h-16 border-b border-slate-100 px-4', collapsed && 'justify-center px-2')}>
        <div className="grid place-items-center h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm shadow-emerald-300/50">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">ESA Energia</div>
            <div className="text-[10px] text-emerald-700 font-semibold tracking-wider uppercase truncate">Gestão de Créditos</div>
          </div>
        )}
      </div>
      <nav className={cn('flex-1 p-2.5 space-y-0.5 overflow-y-auto', collapsed && 'p-2')}>
        {navItems.map((item) => {
          const active = view === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              title={collapsed ? item.label : undefined}
              onClick={() => { setView(item.key); onNav?.(); }}
              className={cn(
                'group w-full flex items-center gap-3 rounded-lg text-sm transition-all',
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                active ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600')} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.hint && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0', active ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700')}>
                      {item.hint}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="p-3 border-t border-slate-100">
          <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-3.5 text-white shadow-sm">
            <div className="text-[10px] uppercase tracking-wider text-emerald-100 font-semibold">Ciclo atual</div>
            <div className="text-base font-semibold mt-0.5">Julho / 2026</div>
            <div className="text-[10px] text-emerald-100 mt-1.5">Fechamento em 5 dias úteis</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    return onNavigate((v: EsaView) => {
      const viewMap: Partial<Record<EsaView, ViewKey>> = {
        dashboard: 'dashboard', ug: 'ug', ub: 'ub',
        apuracao: 'apuracao', csv: 'csv', relatorios: 'relatorios',
        financeiro: 'financeiro', alertas: 'alertas',
      };
      const mapped = viewMap[v];
      if (mapped) setView(mapped);
    });
  }, []);

  const content: Record<ViewKey, ReactNode> = {
    dashboard: <Dashboard onNavigate={setView} />,
    ug: <GeneratingUnitsView />,
    ub: <BeneficiaryUnitsView />,
    apuracao: <MonthlySettlement />,
    csv: <CsvImport />,
    relatorios: <Reports />,
    financeiro: <Financial />,
    alertas: <AlertsView />,
  };

  const t = titles[view];

  return (
    <div className="flex min-h-screen bg-[#f6f8f6] text-slate-800">
      <aside className={cn('hidden md:flex flex-col border-r border-slate-200 bg-white transition-[width] duration-200 relative', collapsed ? 'w-16' : 'w-60')}>
        <SidebarBody view={view} setView={setView} collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm grid place-items-center text-slate-500 hover:text-emerald-700 hover:border-emerald-300"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 border-b border-slate-200 bg-white flex items-center justify-between px-3 md:px-6 gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button aria-label="Abrir menu" className="md:hidden h-9 w-9 grid place-items-center rounded-lg border border-slate-200 text-slate-600 shrink-0">
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarBody view={view} setView={setView} collapsed={false} onNav={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-semibold text-slate-900 truncate leading-tight">{t.title}</h1>
              <p className="text-[10px] md:text-xs text-slate-500 truncate hidden sm:block">{t.sub}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 w-64 xl:w-72">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input placeholder="Buscar UG, UB ou fatura..." className="bg-transparent text-sm outline-none flex-1 placeholder:text-slate-400" />
            </div>
            <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 grid place-items-center text-white text-[10px] md:text-xs font-semibold shadow-sm shrink-0">
              ESA
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 overflow-x-hidden">{content[view]}</main>
      </div>
    </div>
  );
}
