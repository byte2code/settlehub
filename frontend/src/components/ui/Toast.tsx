import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Success toast with an action button (e.g. Undo) that stays for `ms`. */
  undoable: (message: string, label: string, onClick: () => void, ms?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

const STYLES: Record<Tone, string> = {
  success: 'border-emerald-500/30 text-pos',
  error: 'border-rose-500/30 text-neg',
  info: 'border-sky-500/30 text-sky-500',
};
const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (tone: Tone, message: string, action?: ToastItem['action'], ms?: number) => {
      const id = nextId++;
      setItems((all) => [...all.slice(-3), { id, tone, message, action }]);
      setTimeout(() => dismiss(id), ms ?? (tone === 'error' ? 6000 : 3500));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      undoable: (m, label, onClick, ms = 5000) =>
        push('success', m, { label, onClick: () => { onClick(); }, }, ms),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl border bg-surface px-3.5 py-3 text-sm shadow-xl animate-fade-in ${STYLES[t.tone]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 text-fg">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  className="rounded-lg px-2 py-0.5 text-xs font-bold text-brand-fg hover:bg-surface-3"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
