"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { id: number; message: string; error: boolean };
type ToastFn = (message: string, opts?: { error?: boolean }) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<ToastFn>((message, opts) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, error: !!opts?.error });
    timer.current = window.setTimeout(() => setToast(null), opts?.error ? 4200 : 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            role={toast.error ? "alert" : "status"}
            className={`toast-in max-w-md rounded-full px-5 py-3 text-center text-[14px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)] ${
              toast.error ? "bg-danger" : "bg-ink"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
