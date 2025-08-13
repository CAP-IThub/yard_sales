"use client";
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/components/toast/useToast';

export default function ActiveCycleClient({ cycle }) {
  const [quantities, setQuantities] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState(cycle.items.map(it => ({ ...it, userQty: it.userQty || 0 })));
  const toast = useToast();
  const userClaimedTotal = items.reduce((a,b)=>a + (b.userQty||0),0);
  const cycleRemainingForUser = cycle.maxItemsPerUser - userClaimedTotal;
  const formatNaira = (n)=> '₦'+Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2});
  const pendingUnits = Object.entries(quantities).reduce((a,[,v])=>a + (Number(v)||0),0);
  const pendingValue = items.reduce((sum,it)=> sum + (Number(quantities[it.id]||0) * Number(it.price||0)),0);
  const claimedValue = items.reduce((sum,it)=> sum + ((it.userQty||0) * Number(it.price||0)),0);

  const remainingFor = (item) => item.totalQty - item.allocatedQty;

  const adjustQty = (item, delta) => {
    const rem = remainingFor(item);
    const cycleRemaining = cycleRemainingForUser;
  const perItemRemaining = item.maxQtyPerUser != null ? item.maxQtyPerUser - (item.userQty||0) : rem;
    if (rem <= 0 || cycleRemaining <= 0 || perItemRemaining <= 0) return; // nothing to allocate
    setQuantities(q => {
      const current = Number(q[item.id] || 0);
      let next = current + delta;
      if (next < 0) next = 0;
      // Max cannot exceed remaining for item nor cycle remaining minus already requested for other items this submit round
      const provisional = { ...q, [item.id]: next };
      const totalRequested = Object.entries(provisional).reduce((a,[id,val]) => a + (id===item.id ? next : Number(val)||0),0);
      const cap = Math.min(rem, cycleRemaining, perItemRemaining);
      if (next > cap) next = cap;
      // Additional guard if overall requested exceeds cycleRemaining
      const otherRequested = totalRequested - next;
      if (otherRequested + next > cycleRemaining) {
        next = Math.max(0, cycleRemaining - otherRequested);
      }
      return { ...q, [item.id]: next };
    });
  };

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
            if (item.maxQtyPerUser != null && (item.userQty||0) + sel.qty > item.maxQtyPerUser) {
        setError(`Per-item limit exceeded for ${item.name}`);
        return;
      }
      // Check cycle quota remaining
      if (sel.qty > cycleRemainingForUser) {
        setError('Requested quantity exceeds your remaining cycle quota');
        return;
      }
    }
    const selections = raw.filter(s => s.qty > 0);
    if (selections.length === 0) { setError('Enter at least one quantity'); return; }
    // Sum check across selections vs remaining cycle quota
    const sumRequested = selections.reduce((a,b)=>a+b.qty,0);
    if (sumRequested > cycleRemainingForUser) {
      setError('Total requested exceeds your remaining cycle quota');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selections, idempotencyKey: uuidv4() }) });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to submit';
        setError(msg);
        toast.error(msg);
      } else {
        // Update items with fresh remaining snapshot
        const updatedMap = Object.fromEntries(data.items.map(i => [i.id, i]));
        setItems(prev => prev.map(it => {
          const fresh = updatedMap[it.id];
          if (!fresh) return it;
          const added = selections.find(s=>s.itemId===it.id)?.qty || 0;
            return { ...fresh, userQty: (it.userQty||0) + added };
        }));
        setQuantities({});
        toast.success('Selections submitted');
      }
    } catch (e) {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // SSE subscription
  const esRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (esRef.current) esRef.current.close();
      const es = new EventSource('/api/stream');
      esRef.current = es;
      es.onmessage = (ev) => {
        if (cancelled) return;
        if (!ev.data) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'items.updated') {
            if (msg.payload.cycleId !== cycle.id) return; // only this cycle
            const byId = Object.fromEntries(msg.payload.items.map(i => [i.id, i]));
            setItems(prev => prev.map(it => byId[it.id] ? { ...it, allocatedQty: byId[it.id].allocatedQty, totalQty: byId[it.id].totalQty } : it));
          } else if (msg.type === 'cycle.status') {
            if (msg.payload.id === cycle.id && msg.payload.status !== 'OPEN') {
              toast.info(`Cycle is now ${msg.payload.status}`);
            }
          }
        } catch {}
      };
      es.onerror = () => {
        // Attempt simple retry after delay
        setTimeout(() => connect(), 4000);
      };
    };
    connect();
    return () => { cancelled = true; if (esRef.current) esRef.current.close(); };
  }, [cycle.id, toast]);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-[11px] text-neutral-400 flex flex-wrap gap-x-6 gap-y-1">
        <span>Claimed: {userClaimedTotal} ({formatNaira(claimedValue)})</span>
        <span>Pending: {pendingUnits} ({formatNaira(pendingValue)})</span>
        <span>Prospective total: {userClaimedTotal + pendingUnits} ({formatNaira(claimedValue + pendingValue)})</span>
        <span>Remaining quota: {cycleRemainingForUser < 0 ? 0 : cycleRemainingForUser}</span>
        <span>Max/user: {cycle.maxItemsPerUser}</span>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {items.length === 0 && (
          <div className="col-span-full text-center text-xs text-neutral-500 border border-dashed border-neutral-700 rounded p-6">
            No items available in this cycle yet.
          </div>
        )}
        {items.map(item => {
          const rem = remainingFor(item);
          const userQty = item.userQty || 0;
          const inputValue = quantities[item.id] || '';
          const cycleCap = cycleRemainingForUser < 0 ? 0 : cycleRemainingForUser;
                    const perItemRemaining = item.maxQtyPerUser != null ? item.maxQtyPerUser - userQty : rem;
          const maxSelectable = Math.min(rem, cycleCap || rem, perItemRemaining);
          return (
            <div key={item.id} className="border border-neutral-800 rounded p-3 bg-neutral-800/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-100">{item.name} <span className="text-neutral-400 font-normal text-[10px]">₦{Number(item.price||0).toLocaleString('en-NG',{minimumFractionDigits:2})}</span></span>
                <span className="text-neutral-400">{item.allocatedQty}/{item.totalQty}</span>
              </div>
              {item.description && <div className="text-[10px] text-neutral-400 leading-snug">{item.description}</div>}
                            <div className="text-[10px] text-neutral-500 flex justify-between" title={item.maxQtyPerUser != null ? `Per-item limit: ${item.maxQtyPerUser} (you have ${userQty})` : ''}><span>Remaining: {rem}</span><span>You: {userQty}{item.maxQtyPerUser != null && <span className="text-[9px] text-neutral-600"> / {item.maxQtyPerUser}</span>}{item.maxQtyPerUser != null && perItemRemaining<=0 && <span className="ml-1 text-amber-500">limit</span>}</span></div>
              <div className="space-y-1">
                <label className="block text-[10px] uppercase tracking-wide text-neutral-400">Quantity to claim</label>
                <div className="flex items-stretch gap-1">
                  <button type="button" disabled={rem===0 || cycleCap===0 || perItemRemaining<=0 || !inputValue} onClick={()=>adjustQty(item,-1)} className="px-2 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded disabled:opacity-40">-</button>
                  <input
                    disabled={rem === 0 || cycleCap===0 || perItemRemaining<=0}
                    type="number"
                    min={0}
                    max={maxSelectable}
                    placeholder={rem===0 ? 'Sold out' : '0'}
                    value={inputValue}
                    onChange={e=>onChange(item.id, e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
                    aria-label={`Quantity for ${item.name}`}
                  />
                  <button type="button" disabled={rem===0 || cycleCap===0 || perItemRemaining<=0 || (Number(inputValue)||0) >= maxSelectable} onClick={()=>adjustQty(item,1)} className="px-2 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded disabled:opacity-40">+</button>
                </div>
                {cycleCap===0 && <div className="text-[10px] text-amber-400">You have no remaining cycle quota.</div>}
                {perItemRemaining<=0 && <div className="text-[10px] text-neutral-500">Per-item limit reached.</div>}
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="text-red-400 text-xs">{error}</div>}
      <button disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">{submitting ? 'Submitting...' : 'Submit Selections'}</button>
    </form>
  );
}
