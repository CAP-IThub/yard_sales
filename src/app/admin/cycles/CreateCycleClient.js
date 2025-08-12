"use client";
import { useState } from 'react';

export default function CreateCycleClient() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [maxItemsPerUser, setMaxItemsPerUser] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e){
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch('/api/admin/cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, maxItemsPerUser })
    });
    setLoading(false);
    if(res.ok){
      setOpen(false); setName("");
      // simple refresh
      location.reload();
    } else {
      const j = await res.json().catch(()=>({}));
      setError(j.error || 'Failed');
    }
  }

  if(!open) return <button onClick={()=>setOpen(true)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition shadow">+ New Cycle</button>;

  return (
    <div className="relative">
      <div className="absolute right-0 top-0 z-20 w-72 p-4 rounded-lg border border-neutral-800 bg-neutral-950/90 backdrop-blur space-y-3 shadow-xl">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Create Cycle</h3>
          <button onClick={()=>setOpen(false)} className="text-neutral-500 hover:text-neutral-300 text-xs">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-400">Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} required className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-400">Max Items / User</label>
            <input type="number" min={1} value={maxItemsPerUser} onChange={e=>setMaxItemsPerUser(parseInt(e.target.value)||1)} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          </div>
          {error && <div className="text-xs text-red-500">{error}</div>}
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded py-1.5 text-sm font-medium">{loading?'Creating...':'Create'}</button>
        </form>
      </div>
    </div>
  );
}
