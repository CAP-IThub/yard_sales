"use client";
import { useContext } from 'react';
import { ToastContext } from './ToastContext';
export function useToast(){
  const { push, remove } = useContext(ToastContext);
  return {
    push,
    success: (message, opts={}) => push({ type: 'success', title: 'Success', message, ...opts }),
    error: (message, opts={}) => push({ type: 'error', title: 'Error', message, ...opts }),
    info: (message, opts={}) => push({ type: 'info', title: 'Info', message, ...opts }),
    remove
  };
}
