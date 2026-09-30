"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 5000;
const EXIT_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const beginExit = useCallback((id: string) => {
    if (exitTimers.current.has(id)) return;
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    exitTimers.current.set(
      id,
      setTimeout(() => {
        exitTimers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, EXIT_MS)
    );
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      dismissTimers.current.set(
        id,
        setTimeout(() => {
          dismissTimers.current.delete(id);
          beginExit(id);
        }, AUTO_DISMISS_MS)
      );
    },
    [beginExit]
  );

  const removeToast = useCallback(
    (id: string) => {
      const pending = dismissTimers.current.get(id);
      if (pending) {
        clearTimeout(pending);
        dismissTimers.current.delete(id);
      }
      beginExit(id);
    },
    [beginExit]
  );

  useEffect(() => {
    const exits = exitTimers.current;
    const dismisses = dismissTimers.current;
    return () => {
      exits.forEach((t) => clearTimeout(t));
      dismisses.forEach((t) => clearTimeout(t));
      exits.clear();
      dismisses.clear();
    };
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-tone-success" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-tone-danger" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-tone-warn" />;
      case "info":
        return <Info className="w-5 h-5 text-accent" />;
    }
  };

  const getBorderClass = (type: ToastType) => {
    switch (type) {
      case "success":
        return "border-tone-success";
      case "error":
        return "border-tone-danger";
      case "warning":
        return "border-tone-warn";
      case "info":
        return "border-accent-hairline";
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-exiting={toast.exiting ? "true" : "false"}
            className={`toast-item relative bg-surface-solid rounded-card-sm p-4 pr-10 min-w-[300px] max-w-[400px] border ${getBorderClass(toast.type)}`}
          >
            <div className="flex items-center gap-3">
              {getIcon(toast.type)}
              <p className="text-sm text-ink">{toast.message}</p>
            </div>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => removeToast(toast.id)}
              className="absolute top-3 right-3 text-ink-4 hover:text-ink-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
