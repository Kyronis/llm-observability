'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error';

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
};

type ToastContextValue = {
  show: (variant: ToastVariant, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
const DISMISS_AFTER_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((variant: ToastVariant, message: string) => {
    counter += 1;
    const id = `toast-${counter}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, variant, message }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, DISMISS_AFTER_MS),
    );
    return () => {
      timers.forEach((tid) => window.clearTimeout(tid));
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: ToastItem }) {
  const isError = toast.variant === 'error';
  const wrapperClass = isError
    ? 'bg-error-container border-error text-on-error-container'
    : 'bg-surface-container-lowest border-outline-variant text-on-surface';
  const iconClass = isError ? 'text-error' : 'text-emerald-600';
  const icon = isError ? 'error' : 'check_circle';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg border min-w-[280px] max-w-[420px] transition-opacity ${wrapperClass}`}
    >
      <span className={`material-symbols-outlined text-[20px] shrink-0 ${iconClass}`}>
        {icon}
      </span>
      <p className="text-sm leading-snug flex-1 break-words">{toast.message}</p>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (typeof window !== 'undefined') {
      // 兜底：未挂载 Provider 时降级为 noop，避免崩溃
      // eslint-disable-next-line no-console
      console.warn('useToast must be used within <ToastProvider>');
    }
    return {
      show: () => undefined,
      success: () => undefined,
      error: () => undefined,
    };
  }
  return {
    show: ctx.show,
    success: (message: string) => ctx.show('success', message),
    error: (message: string) => ctx.show('error', message),
  };
}
