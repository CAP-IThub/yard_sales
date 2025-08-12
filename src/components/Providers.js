"use client";
import ToastProvider from './toast/ToastProvider';
import { ConfirmProvider } from './confirm';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  );
}
