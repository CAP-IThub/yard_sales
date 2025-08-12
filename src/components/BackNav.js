"use client";
import { useRouter } from 'next/navigation';
export default function BackNav({ fallbackHref = '/admin/cycles', label = 'Back' }) {
  const router = useRouter();
  function goBack(){
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }
  return (
    <button onClick={goBack} aria-label={label} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-neutral-800/70 hover:bg-neutral-700 text-neutral-200 border border-neutral-700">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/><path d="M9 12h12"/></svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
