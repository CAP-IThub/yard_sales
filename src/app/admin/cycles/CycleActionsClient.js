"use client";
import { useState } from 'react';
import { useConfirm } from '@/components/confirm';
import { useToast } from '@/components/toast/useToast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CycleActionsClient({ cycle }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [localStatus, setLocalStatus] = useState(cycle.status);
  const isDraft = localStatus === 'DRAFT';
  const isOpen = localStatus === 'OPEN';
  const isClosed = localStatus === 'CLOSED';
  const isArchived = localStatus === 'ARCHIVED';
  const confirm = useConfirm();

  async function doAction(action){
    const messages = {
      OPEN: { title: 'Open Cycle', message: `Open cycle "${cycle.name}" now? Once open you cannot edit its items.`, confirmText: 'Open', variant: 'warn' },
      CLOSE: { title: 'Close Cycle', message: `Close cycle "${cycle.name}"? Users will stop being able to claim items.`, confirmText: 'Close', variant: 'warn' },
      REOPEN: { title: 'Reopen Cycle', message: `Reopen cycle "${cycle.name}" allowing users to bid again?`, confirmText: 'Reopen' },
      ARCHIVE: { title: 'Archive Cycle', message: `Archive cycle "${cycle.name}"? This locks changes but results remain accessible.`, confirmText: 'Archive', variant: 'danger' }
    };
    if(messages[action]) { const ok = await confirm(messages[action]); if(!ok) return; }
    setLoading(true);
    const res = await fetch(`/api/admin/cycles?id=${cycle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if(res.ok){
      const updated = await res.json();
      setLocalStatus(updated.status);
      router.refresh();
      toast.success(`Cycle ${action.toLowerCase()}d`);
    } else {
      toast.error('Action failed');
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {isDraft && <button disabled={loading} onClick={()=>doAction('OPEN')} className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white disabled:opacity-50">Open</button>}
      {isOpen && <button disabled={loading} onClick={()=>doAction('CLOSE')} className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">Close</button>}
      {isClosed && !isArchived && <>
        <Link href={`/admin/cycles/${cycle.id}/results`} className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">Results</Link>
        <button disabled={loading} onClick={()=>doAction('REOPEN')} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">Reopen</button>
        <button disabled={loading} onClick={()=>doAction('ARCHIVE')} className="px-2 py-1 rounded bg-neutral-600 hover:bg-neutral-500 text-white disabled:opacity-50">Archive</button>
      </>}
      {isArchived && <Link href={`/admin/cycles/${cycle.id}/results`} className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white">Results</Link>}
    </div>
  );
}
