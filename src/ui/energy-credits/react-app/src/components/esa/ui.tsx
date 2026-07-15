import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { KpiDelta } from '@/lib/esa/types';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60', className)}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  delta,
  deltaLabel,
  onClick,
  invertDelta,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'accent';
  icon?: ReactNode;
  delta?: KpiDelta;
  deltaLabel?: string;
  onClick?: () => void;
  invertDelta?: boolean;
}) {
  const toneMap = {
    default: 'text-slate-900',
    positive: 'text-emerald-700',
    negative: 'text-rose-600',
    accent: 'text-emerald-600',
  };

  const isInteractive = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60 p-3.5 md:p-4',
        isInteractive &&
          'cursor-pointer hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/40 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-slate-500 font-medium truncate">
            {label}
          </div>
          <div className={cn('mt-1.5 md:mt-2 text-xl md:text-2xl font-semibold tabular-nums truncate', toneMap[tone])}>
            {value}
          </div>
          {delta ? (
            <DeltaLine delta={delta} invert={invertDelta} label={deltaLabel} />
          ) : (
            hint && <div className="text-[11px] mt-1 text-slate-500 truncate">{hint}</div>
          )}
        </div>
        {icon && (
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-emerald-50 grid place-items-center text-emerald-600 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaLine({ delta, invert, label }: { delta: KpiDelta; invert?: boolean; label?: string }) {
  const goodUp = !invert;
  const positive =
    delta.direction === 'up' ? goodUp : delta.direction === 'down' ? !goodUp : null;
  const color =
    delta.direction === 'flat' ? 'text-slate-500' : positive ? 'text-emerald-600' : 'text-rose-600';
  const Icon =
    delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : Minus;
  const sign = delta.pct > 0 ? '+' : '';
  return (
    <div className={cn('mt-1 flex items-center gap-1 text-[11px] font-medium', color)}>
      <Icon className="h-3 w-3" />
      <span className="tabular-nums">
        {delta.direction === 'flat' ? 'estável' : `${sign}${delta.pct.toFixed(1)}%`}
      </span>
      {label && <span className="text-slate-400 font-normal">· {label}</span>}
    </div>
  );
}

export function SectionTitle({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'emerald' | 'neutral';
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-rose-100 text-rose-700',
    blue: 'bg-sky-100 text-sky-700',
    neutral: 'bg-white border border-slate-200 text-slate-600',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', map[tone])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'soft' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20',
    ghost: 'text-slate-600 hover:bg-slate-100',
    outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700',
    soft: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
  };
  const sizes: Record<string, string> = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3.5 py-2',
  };
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: 'pago' | 'aberto' | 'vencido' | string }) {
  if (status === 'pago') return <Badge tone="green">Pago</Badge>;
  if (status === 'aberto') return <Badge tone="amber">Em aberto</Badge>;
  if (status === 'vencido') return <Badge tone="red">Vencido</Badge>;
  if (status === 'ativa') return <Badge tone="green">Ativa</Badge>;
  if (status === 'inativa') return <Badge tone="slate">Inativa</Badge>;
  if (status === 'manutencao') return <Badge tone="amber">Manutenção</Badge>;
  return <Badge>{status}</Badge>;
}

export function CycleBadge({ status }: { status: 'aberto' | 'em_apuracao' | 'fechado' }) {
  if (status === 'fechado')
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        FECHADO
      </span>
    );
  if (status === 'em_apuracao')
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        EM APURAÇÃO
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      ABERTO
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  desc,
  size = 'md',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  const widths: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };
  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 grid place-items-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30 flex flex-col max-h-[92vh]',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="h-8 w-8 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap justify-end gap-2 bg-slate-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-1 mb-4">
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={label} className="flex items-center gap-1 md:gap-2 shrink-0">
            <div
              className={cn(
                'h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold border shrink-0',
                done && 'bg-emerald-600 text-white border-emerald-600',
                active && 'bg-emerald-50 text-emerald-700 border-emerald-500',
                !done && !active && 'bg-white text-slate-400 border-slate-200',
              )}
            >
              {done ? '✓' : i + 1}
            </div>
            <span className={cn('text-[11px] md:text-xs whitespace-nowrap', active ? 'text-slate-900 font-medium' : 'text-slate-500')}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 md:w-6 bg-slate-200 mx-1" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Field({
  label,
  hint,
  children,
  colSpan,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  colSpan?: 1 | 2 | 3;
}) {
  const span = colSpan === 2 ? 'sm:col-span-2' : colSpan === 3 ? 'sm:col-span-3' : '';
  return (
    <div className={span}>
      <label className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-emerald-500';
