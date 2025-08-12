"use client";
import { useState } from 'react';

export default function CycleActionsClient({ cycle }) {
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(cycle.status);
  const isDraft = localStatus === 'DRAFT';
  const isOpen = localStatus === 'OPEN';

  async function doAction(action){
    setLoading(true);
    const res = await fetch(`/api/admin/cycles?id=${cycle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if(res.ok){
      const updated = await res.json();
      setLocalStatus(updated.status);
    } else {
      // naive alert
      alert('Action failed');
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {isDraft && <button disabled={loading} onClick={()=>doAction('OPEN')} className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white disabled:opacity-50">Open</button>}
      {isOpen && <button disabled={loading} onClick={()=>doAction('CLOSE')} className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">Close</button>}
      {!isDraft && !isOpen && <span className="text-neutral-500">Closed</span>}
    </div>
  );
}
