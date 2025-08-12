"use client";
import { createContext, useCallback, useContext, useRef, useState } from 'react';
const ConfirmContext = createContext(null);
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState({ open: false });
  const resolverRef = useRef(null);
  const confirm = useCallback((opts) => new Promise(resolve => {
    resolverRef.current = resolve;
    setDialog({
      open: true,
      title: opts.title || 'Are you sure?',
      message: opts.message || opts.description || 'Please confirm this action.',
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      variant: opts.variant || 'default'
    });
  }), []);
  const handleClose = useCallback(() => { setDialog(d=>({...d,open:false})); if(resolverRef.current) resolverRef.current(false); }, []);
  const handleConfirm = useCallback(() => { setDialog(d=>({...d,open:false})); if(resolverRef.current) resolverRef.current(true); }, []);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg p-5 shadow-lg">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">{dialog.variant==='danger' && <span className="inline-block w-2 h-2 rounded-full bg-red-500" />}{dialog.title}</h2>
            <p className="text-xs text-neutral-400 leading-relaxed mb-4 whitespace-pre-line">{dialog.message}</p>
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={handleClose} className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200">{dialog.cancelText}</button>
              <button onClick={handleConfirm} className={`px-3 py-1 rounded text-white ${dialog.variant==='danger'?'bg-red-600 hover:bg-red-500':dialog.variant==='warn'?'bg-amber-600 hover:bg-amber-500':'bg-indigo-600 hover:bg-indigo-500'}`}>{dialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
export function useConfirm(){ const ctx = useContext(ConfirmContext); if(!ctx) throw new Error('useConfirm must be used within ConfirmProvider'); return ctx; }
