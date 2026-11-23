// Designsystem-Bausteine (shadcn/ui-Stil, ohne CLI – siehe ARCHITECTURE.md).
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' | 'icon' }>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...p }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        size === 'icon' && 'h-11 w-11',
        variant === 'primary' && 'bg-primary text-primary-fg shadow-sm shadow-primary/30 ring-1 ring-inset ring-gold/30 hover:brightness-110',
        variant === 'secondary' && 'bg-fg/[0.06] text-fg hover:bg-fg/10',
        variant === 'ghost' && 'text-fg hover:bg-fg/[0.06]',
        variant === 'outline' && 'border bg-card text-fg hover:bg-fg/[0.04]',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
      {...p}
    />
  ),
);
Button.displayName = 'Button';

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)} {...p} />;
}

export function CardTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn('h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none', className)} {...p} />
));
Input.displayName = 'Input';

export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn('min-h-[88px] w-full rounded-xl border bg-card p-3 text-fg focus:border-accent focus:outline-none', p.className)} />;
}

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-fg focus:border-accent focus:outline-none', className)} {...p}>
      {children}
    </select>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Zahlenfeld, das leere Eingaben als undefined liefert (statt 0). */
export function NumberInput({ value, onValue, step = 'any', ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | undefined | null; onValue: (v: number | undefined) => void }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        onValue(raw === '' ? undefined : Number(raw));
      }}
      {...p}
    />
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'info'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'bg-fg/[0.07] text-muted',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'danger' && 'bg-danger/15 text-danger',
        tone === 'info' && 'bg-protein/15 text-protein',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  // Portal: Sheets liegen immer direkt im body – animierte Eltern (transform) würden „fixed“ sonst einsperren.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cn('relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border bg-card shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button data-close variant="ghost" size="icon" aria-label="Schließen" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && <div className="safe-bottom flex gap-2 border-t p-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto rounded-xl bg-fg/[0.05] p-1', className)}>
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn('h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition', value === i.value ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg')}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, max, color = 'accent', className, label }: { value: number; max: number; color?: 'accent' | 'protein' | 'carbs' | 'fat' | 'danger'; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-fg/[0.07]', className)} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          over ? 'bg-danger' : color === 'accent' ? 'bg-accent' : color === 'protein' ? 'bg-protein' : color === 'carbs' ? 'bg-carbs' : color === 'fat' ? 'bg-fat' : 'bg-danger',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Ring({ value, max, size = 150, stroke = 12, children }: { value: number; max: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--primary) / 0.18)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? 'rgb(var(--danger))' : 'rgb(var(--accent))'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, unit, sub }: { label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="truncate text-lg font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-fg/20')}>
      <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export const fmt = (v: number | null | undefined, digits = 0, fallback = '–') => (v == null || !Number.isFinite(v) ? fallback : v.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 }));
