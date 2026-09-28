import { forwardRef, useEffect } from 'react';
import { Loader2, X, Inbox } from 'lucide-react';
import { cx } from '../lib/utils.js';

/* ----------------------------- Button ----------------------------- */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref
) {
  const sizes = { sm: 'px-3 py-1.5 text-[13px]', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-[15px]' };
  const variants = {
    primary: 'btn-primary',
    soft: 'btn-soft',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
    danger: 'btn-danger',
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ----------------------------- Field ------------------------------ */
export function Field({ label, error, hint, children, className }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ error, className, ...rest }, ref) {
  return <input ref={ref} className={cx('field', error && 'field-error', className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ error, className, ...rest }, ref) {
  return (
    <textarea ref={ref} className={cx('field resize-y', error && 'field-error', className)} {...rest} />
  );
});

export const Select = forwardRef(function Select({ error, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx('field appearance-none pr-9', error && 'field-error', className)} {...rest}>
      {children}
    </select>
  );
});

/* ----------------------------- Card ------------------------------- */
export function Card({ className, children, ...rest }) {
  return (
    <div className={cx('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action, className }) {
  return (
    <div className={cx('mb-4 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------- Badge ------------------------------ */
const BADGE_TONES = {
  blue: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
  sky: 'bg-sky-50 text-sky-700',
};

export function Badge({ tone = 'slate', className, children, ...rest }) {
  return (
    <span className={cx('chip', BADGE_TONES[tone] || BADGE_TONES.slate, className)} {...rest}>
      {children}
    </span>
  );
}

/* ----------------------------- Spinner ---------------------------- */
export function Spinner({ className, label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-10 text-ink-mute">
      <Loader2 className={cx('h-5 w-5 animate-spin text-brand-500', className)} />
      <span className="text-sm font-medium">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} />;
}

/* --------------------------- Empty state -------------------------- */
export function EmptyState({ icon: Icon = Inbox, title, message, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-ink-mute">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ----------------------------- Modal ------------------------------ */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-card',
          'animate-slide-up sm:rounded-3xl',
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-mute">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-ink-mute transition hover:bg-slate-100 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', busy, tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
    </Modal>
  );
}

/* ----------------------------- Tabs ------------------------------- */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1 no-scrollbar', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition',
            value === t.value
              ? 'bg-white text-brand-700 shadow-soft'
              : 'text-ink-soft hover:text-ink'
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
          {t.count != null && (
            <span className="rounded-full bg-slate-200/80 px-1.5 text-[11px] font-bold text-ink-soft">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------- Stat tile ------------------------------ */
export function StatTile({ icon: Icon, label, value, tone = 'blue', sub }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <Card className="p-4 card-hover">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-ink-mute">{label}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink">{value}</p>
          {sub && <p className="mt-0.5 truncate text-[12px] text-ink-mute">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- Avatar -------------------------------- */
export function Avatar({ name, size = 'md', className }) {
  const sizes = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-[13px]', lg: 'h-14 w-14 text-lg' };
  const letters =
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || '?';
  return (
    <div
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 font-bold text-white shadow-soft',
        sizes[size],
        className
      )}
    >
      {letters}
    </div>
  );
}
