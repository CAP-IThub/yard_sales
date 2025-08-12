"use client";
import { useCallback, useState, useEffect } from 'react';
import { ToastContext } from './ToastContext';
let idCounter = 0;
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), []);
  const push = useCallback((toast) => { const id = ++idCounter; setToasts(ts => [...ts, { id, ...toast }]); return id; }, []);
  useEffect(() => { if (toasts.length === 0) return; const timers = toasts.map(t => setTimeout(() => remove(t.id), t.duration || 4000)); return () => timers.forEach(clearTimeout); }, [toasts, remove]);
  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 w-72 max-w-[90vw] pointer-events-none">
        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          {toasts.map(t => (
            <div key={t.id} className={"pointer-events-auto group relative overflow-hidden rounded-md border text-xs shadow-lg transition flex items-start gap-2 p-3 " + (t.type === 'error' ? 'bg-red-900/60 border-red-700 text-red-200' : t.type === 'success' ? 'bg-indigo-900/60 border-indigo-600 text-indigo-100' : 'bg-neutral-800/70 border-neutral-700 text-neutral-100')} role="status">
              <div className="flex-1">{t.title && <div className="font-semibold tracking-wide mb-0.5">{t.title}</div>}{t.message && <div className="leading-snug text-[11px] opacity-90">{t.message}</div>}</div>
              <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 text-[10px] mt-0.5">✕</button>
              <div className={"absolute bottom-0 left-0 h-0.5 bg-gradient-to-r " + (t.type === 'error' ? 'from-red-400 to-red-600' : t.type === 'success' ? 'from-indigo-400 to-fuchsia-500' : 'from-neutral-400 to-neutral-500')} style={{ width: '100%' }} />
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
