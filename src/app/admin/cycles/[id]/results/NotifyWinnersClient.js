"use client";
import { useState } from 'react';
import { useConfirm } from '@/components/confirm/ConfirmContext';

export default function NotifyWinnersClient({ cycleId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  const send = async () => {
    const proceed = await confirm({
      title: 'Email Winners?',
      message: 'This will send individualized payment & allocation summary emails to all users who won items in this cycle.\n\nAre you sure you want to proceed?',
      confirmText: 'Send Emails',
      variant: 'warn'
    });
    if(!proceed) return;
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`/api/admin/cycles/${cycleId}/notify-winners`, { method: 'POST' });
      const data = await res.json();
      if(!res.ok) {
        setStatus({ ok:false, msg: data.error || 'Failed' });
      } else {
        setStatus({ ok:true, msg: `Sent ${data.sent} (errors ${data.errors}) • Deadline ${data.deadline}` });
      }
    } catch(e){
      setStatus({ ok:false, msg: 'Network error' });
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={send} disabled={loading} className="text-xs px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white">{loading? 'Sending...' : 'Email Winners'}</button>
      {status && <div className={`text-[10px] ${status.ok? 'text-emerald-400':'text-red-400'}`}>{status.msg}</div>}
    </div>
  );
}
