"use client";
import { useEffect, useState } from 'react';
import { useConfirm } from '@/components/confirm';
import { useRouter } from 'next/navigation';

export default function ManageItemsClient({ cycleId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', totalQty: '', maxQtyPerUser: '' }); // maxQtyPerUser blank => unlimited
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', totalQty: '', maxQtyPerUser: '' });
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const router = useRouter();
  const confirm = useConfirm();

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
        price: Number(form.price||0),
        totalQty: Number(form.totalQty),
  maxQtyPerUser: form.maxQtyPerUser === '' ? null : Number(form.maxQtyPerUser),
      }) });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || 'Failed');
      } else {
  setForm({ name: '', description: '', price: '', totalQty: '', maxQtyPerUser: '' });
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
      price: it.price == null ? '' : String(it.price),
      totalQty: String(it.totalQty || ''),
      maxQtyPerUser: it.maxQtyPerUser == null ? '' : String(it.maxQtyPerUser)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  setEditForm({ name: '', description: '', price: '', totalQty: '', maxQtyPerUser: '' });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true); setError('');
    try {
      const body = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
  price: editForm.price === '' ? undefined : Number(editForm.price),
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
    const ok = await confirm({ title: 'Delete Item', message: `Delete item "${it.name}"? This cannot be undone.`, confirmText: 'Delete', variant: 'danger' });
    if(!ok) return;
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
      {/* Bulk import section */}
      <BulkImport
        cycleId={cycleId}
        importing={importing}
        setImporting={setImporting}
        importStatus={importStatus}
        setImportStatus={setImportStatus}
        onDone={()=>{ load(); }}
      />
      <form onSubmit={submit} className="grid md:grid-cols-5 gap-2 mb-4 text-sm">
        <input required placeholder="Name" className="bg-neutral-800 rounded px-2 py-1" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <input placeholder="Description" className="bg-neutral-800 rounded px-2 py-1" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <input required type="number" step="0.01" min={0} placeholder="Price" className="bg-neutral-800 rounded px-2 py-1" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} />
        <input required type="number" min={1} placeholder="Total Qty" className="bg-neutral-800 rounded px-2 py-1" value={form.totalQty} onChange={e=>setForm(f=>({...f,totalQty:e.target.value}))} />
  <input type="number" placeholder="Max/User (blank = unlimited)" className="bg-neutral-800 rounded px-2 py-1" value={form.maxQtyPerUser} onChange={e=>setForm(f=>({...f,maxQtyPerUser:e.target.value}))} />
  {/* Helper note spanning full width on small screens */}
  <div className="col-span-full text-[10px] text-neutral-500 -mt-1">Leave Max/User blank for no per-item limit. Cycle total cap still applies.</div>
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
            <div className="font-medium text-neutral-100">{it.name} <span className="text-neutral-400 font-normal text-[10px]">₦{Number(it.price||0).toLocaleString('en-NG',{minimumFractionDigits:2})}</span></div>
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
                  <form onSubmit={saveEdit} className="grid md:grid-cols-6 gap-2 items-end">
                    <input required placeholder="Name" className="bg-neutral-700 rounded px-2 py-1" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} />
                    <input placeholder="Description" className="bg-neutral-700 rounded px-2 py-1" value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} />
                    <input required type="number" step="0.01" min={0} placeholder="Price" className="bg-neutral-700 rounded px-2 py-1" value={editForm.price} onChange={e=>setEditForm(f=>({...f,price:e.target.value}))} />
                    <input required type="number" min={1} placeholder="Total Qty" className="bg-neutral-700 rounded px-2 py-1" value={editForm.totalQty} onChange={e=>setEditForm(f=>({...f,totalQty:e.target.value}))} />
                    <input type="number" placeholder="Max/User (blank = unlimited)" className="bg-neutral-700 rounded px-2 py-1" value={editForm.maxQtyPerUser} onChange={e=>setEditForm(f=>({...f,maxQtyPerUser:e.target.value}))} />
                    <div className="md:col-span-6 text-[10px] text-neutral-500 -mt-1">Clear the field to remove the per-item limit.</div>
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

function BulkImport({ cycleId, importing, setImporting, importStatus, setImportStatus, onDone }){
  const confirm = useConfirm();
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const ok = await confirm({
      title: 'Bulk import items?',
      message: 'This will create items for this DRAFT cycle from the uploaded file.\n\nAccepted: CSV or XLSX\nColumns: Name, Description, Price, TotalQty, MaxQtyPerUser (optional).',
      confirmText: 'Import',
      variant: 'warn'
    });
    if(!ok) { e.target.value=''; return; }
    setImportStatus(null);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/cycles/${cycleId}/items/import`, { method: 'POST', body: fd });
      const j = await res.json();
      if(!res.ok){
        setImportStatus({ ok:false, msg: j.error || 'Import failed' });
      } else {
        const msg = `Created ${j.created}, Failed ${j.failed}${j.errors?.length? ' • First error: '+(j.errors[0]?.error+' @ row '+(j.errors[0]?.row)) : ''}`;
        setImportStatus({ ok:true, msg });
        onDone?.();
      }
    } catch (err){
      setImportStatus({ ok:false, msg: 'Network error' });
    } finally {
      setImporting(false);
      e.target.value='';
    }
  };
  const templateCsv = 'Name,Description,Price,TotalQty,MaxQtyPerUser\nSample item,Optional text,100000,5,2';
  return (
    <div className="mb-4 p-3 rounded border border-neutral-700 bg-neutral-900/50">
      <div className="flex flex-col md:flex-row md:items-center gap-2 text-xs">
        <div className="flex items-center gap-2">
          <label className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700 cursor-pointer hover:bg-neutral-700">
            <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" onChange={onFileChange} disabled={importing} />
            {importing ? 'Importing…' : 'Bulk Import'}
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}
            download={`cycle-${cycleId}-items-template.csv`}
            className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
          >
            Download Template
          </a>
        </div>
        <div className="text-[10px] text-neutral-500">CSV/XLSX with columns: Name, Description, Price, TotalQty, MaxQtyPerUser (blank for unlimited)</div>
      </div>
      {importStatus && <div className={`mt-2 text-[11px] ${importStatus.ok?'text-emerald-400':'text-red-400'}`}>{importStatus.msg}</div>}
    </div>
  );
}
