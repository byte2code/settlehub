import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Promise-based replacement for window.confirm that matches the app's look. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current(value);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => close(false)}
        size="sm"
        title={options?.title}
        icon={options?.danger ? <AlertTriangle className="h-5 w-5 text-neg" /> : undefined}
        footer={
          <>
            <button className="btn-ghost" onClick={() => close(false)}>
              Cancel
            </button>
            <button className={options?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} data-autofocus>
              {options?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <div className="text-sm text-muted">{options?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
