"use client";
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function ActiveCycleClient({ cycle }) {
  const [quantities, setQuantities] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState(cycle.items);

  const remainingFor = (item) => item.totalQty - item.allocatedQty;

  const onChange = (itemId, value) => {
    setQuantities(q => ({ ...q, [itemId]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const raw = Object.entries(quantities)
      .map(([itemId, v]) => ({ itemId, qty: Number(v) }));
    // Validate client-side
    for (const sel of raw) {
      if (!sel.qty) continue; // skip empty
      if (!Number.isInteger(sel.qty) || sel.qty < 0) {
        setError('Quantities must be whole non-negative numbers');
        return;
      }
      const item = items.find(i => i.id === sel.itemId);
      if (!item) continue;
      const rem = remainingFor(item);
      if (sel.qty > rem) {
        setError(`Requested qty exceeds remaining for ${item.name}`);
        return;
      }
    }
    const selections = raw.filter(s => s.qty > 0);
    if (selections.length === 0) { setError('Enter at least one quantity'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selections, idempotencyKey: uuidv4() }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit');
      } else {
        // Update items with fresh remaining snapshot
        const updatedMap = Object.fromEntries(data.items.map(i => [i.id, i]));
        setItems(prev => prev.map(it => updatedMap[it.id] || it));
        setQuantities({});
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        {items.map(item => {
          const rem = remainingFor(item);
          return (
            <div key={item.id} className="border border-neutral-800 rounded p-3 bg-neutral-800/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-100">{item.name}</span>
                <span className="text-neutral-400">{item.allocatedQty}/{item.totalQty}</span>
              </div>
              {item.description && <div className="text-[10px] text-neutral-400 leading-snug">{item.description}</div>}
              <div className="text-[10px] text-neutral-500">Remaining: {rem}</div>
              <input disabled={rem === 0} type="number" min={0} max={rem} placeholder="Qty" value={quantities[item.id] || ''} onChange={e=>onChange(item.id, e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs" />
            </div>
          );
        })}
      </div>
      {error && <div className="text-red-400 text-xs">{error}</div>}
      <button disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">{submitting ? 'Submitting...' : 'Submit Selections'}</button>
    </form>
  );
}
