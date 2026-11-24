import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type, message) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);

      timersRef.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const toast = useMemo(
    () => ({
      success: (message) => addToast("success", message),
      error: (message) => addToast("error", message),
      info: (message) => addToast("info", message),
    }),
    [addToast]
  );

  const typeStyles = {
    success: "bg-green-600 text-white border-green-700",
    error: "bg-red-600 text-white border-red-700",
    info: "bg-blue-600 text-white border-blue-700",
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div className="fixed top-5 right-5 z-[100] space-y-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
              typeStyles[t.type] || typeStyles.info
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-white/80 hover:text-white font-bold leading-none"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
