"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ManageItemsClient({ cycleId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', totalQty: '', maxQtyPerUser: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', totalQty: '', maxQtyPerUser: '' });
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cycles/${cycleId}/items`);
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [cycleId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`/api/admin/cycles/${cycleId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        totalQty: Number(form.totalQty),
        maxQtyPerUser: form.maxQtyPerUser ? Number(form.maxQtyPerUser) : null,
      }) });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || 'Failed');
      } else {
        setForm({ name: '', description: '', totalQty: '', maxQtyPerUser: '' });
        load();
      }
    } catch (e) {
      setError('Network error');
    }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setEditForm({
      name: it.name || '',
      description: it.description || '',
      totalQty: String(it.totalQty || ''),
      maxQtyPerUser: it.maxQtyPerUser == null ? '' : String(it.maxQtyPerUser)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', description: '', totalQty: '', maxQtyPerUser: '' });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true); setError('');
    try {
      const body = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        totalQty: editForm.totalQty ? Number(editForm.totalQty) : undefined,
        maxQtyPerUser: editForm.maxQtyPerUser === '' ? null : Number(editForm.maxQtyPerUser)
      };
      const res = await fetch(`/api/admin/items/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || 'Failed to update');
      } else {
        cancelEdit();
        load();
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (it) => {
    if (!confirm(`Delete item "${it.name}"? This cannot be undone.`)) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/admin/items/${it.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || 'Failed to delete');
      } else {
        if (editingId === it.id) cancelEdit();
        load();
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border border-neutral-700 rounded p-4 bg-neutral-900/60">
      <h3 className="font-semibold mb-2">Items</h3>
      <form onSubmit={submit} className="grid md:grid-cols-4 gap-2 mb-4 text-sm">
        <input required placeholder="Name" className="bg-neutral-800 rounded px-2 py-1" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <input placeholder="Description" className="bg-neutral-800 rounded px-2 py-1" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <input required type="number" min={1} placeholder="Total Qty" className="bg-neutral-800 rounded px-2 py-1" value={form.totalQty} onChange={e=>setForm(f=>({...f,totalQty:e.target.value}))} />
        <input type="number" min={1} placeholder="Max/User (optional)" className="bg-neutral-800 rounded px-2 py-1" value={form.maxQtyPerUser} onChange={e=>setForm(f=>({...f,maxQtyPerUser:e.target.value}))} />
        <button className="col-span-full md:col-span-1 bg-indigo-600 hover:bg-indigo-500 transition text-white rounded px-3 py-1">Add</button>
        {error && <div className="col-span-full text-red-400 text-xs">{error}</div>}
      </form>
      {loading ? <div className="text-xs text-neutral-400">Loading...</div> : (
        <div className="space-y-2">
          {items.length === 0 && <div className="text-xs text-neutral-500">No items yet.</div>}
          {items.map(it => {
            const isEditing = editingId === it.id;
            return (
              <div key={it.id} className="bg-neutral-800/60 rounded px-3 py-2 text-xs space-y-2">
                {!isEditing && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-100">{it.name}</div>
                      {it.description && <div className="text-neutral-400">{it.description}</div>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div>{it.allocatedQty}/{it.totalQty}</div>
                      {it.maxQtyPerUser && <div className="text-neutral-400">max/user {it.maxQtyPerUser}</div>}
                      <div className="flex gap-2">
                        <button type="button" onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-[10px]">Edit</button>
                        <button type="button" onClick={()=>deleteItem(it)} className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-[10px]">Delete</button>
                      </div>
                    </div>
                  </div>
                )}
                {isEditing && (
                  <form onSubmit={saveEdit} className="grid md:grid-cols-5 gap-2 items-end">
                    <input required placeholder="Name" className="bg-neutral-700 rounded px-2 py-1" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} />
                    <input placeholder="Description" className="bg-neutral-700 rounded px-2 py-1" value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} />
                    <input required type="number" min={1} placeholder="Total Qty" className="bg-neutral-700 rounded px-2 py-1" value={editForm.totalQty} onChange={e=>setEditForm(f=>({...f,totalQty:e.target.value}))} />
                    <input type="number" min={1} placeholder="Max/User" className="bg-neutral-700 rounded px-2 py-1" value={editForm.maxQtyPerUser} onChange={e=>setEditForm(f=>({...f,maxQtyPerUser:e.target.value}))} />
                    <div className="flex gap-2">
                      <button disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded px-3 py-1">Save</button>
                      <button type="button" onClick={cancelEdit} className="bg-neutral-600 hover:bg-neutral-500 rounded px-3 py-1">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
