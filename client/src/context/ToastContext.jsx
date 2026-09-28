import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cx } from '../lib/utils.js';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  error: { icon: AlertTriangle, ring: 'ring-rose-200', bg: 'bg-rose-50', text: 'text-rose-700' },
  info: { icon: Info, ring: 'ring-brand-200', bg: 'bg-brand-50', text: 'text-brand-700' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message, tone = 'info', ttl = 4200) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, message, tone }]);
      if (ttl) setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 6000),
      info: (m) => push(m, 'info'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[1200] flex flex-col items-center gap-2 px-3 sm:items-end sm:px-6">
        {toasts.map((t) => {
          const tone = TONES[t.tone] || TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={cx(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3',
                'shadow-card ring-1 animate-slide-up',
                tone.bg,
                tone.ring
              )}
            >
              <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', tone.text)} />
              <p className={cx('flex-1 text-sm font-medium leading-snug', tone.text)}>{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-1 text-current opacity-50 transition hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
