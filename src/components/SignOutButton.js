"use client";
import { signOut } from 'next-auth/react';

export default function SignOutButton({ className = '' }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className={`text-xs px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200 transition ${className}`}
      type="button"
    >
      Sign Out
    </button>
  );
}
