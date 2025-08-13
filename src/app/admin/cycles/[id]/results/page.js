import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import BackNav from '@/components/BackNav';

export const dynamic = 'force-dynamic';

async function getData(cycleId){
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if(!cycle) return null;
  const itemsRaw = await prisma.item.findMany({ where: { cycleId }, orderBy: { createdAt: 'asc' } });
  const items = itemsRaw.map(it => ({ ...it, price: it.price != null ? Number(it.price) : null }));
  const bids = await prisma.bid.findMany({ where: { cycleId }, include: { user: true, item: true } });
  const perUser = new Map();
  bids.forEach(b => {
    if(!perUser.has(b.userId)) perUser.set(b.userId,{ email: b.user.email, total:0, totalValue:0, lines:[] });
    const u=perUser.get(b.userId);
    const price = b.item?.price != null ? Number(b.item.price) : 0;
    u.total += b.qty;
    u.totalValue += b.qty * price;
    u.lines.push({ item:b.item.name, qty:b.qty });
  });
  const users = Array.from(perUser.values()).sort((a,b)=>b.total-a.total); // still sort by quantity as heading states
  return { cycle, items, bids, users };
}

export default async function ResultsPage({ params: paramsPromise }) {
  const params = await paramsPromise; // await dynamic params per Next.js guidance
  const session = await getServerSession(authOptions);
  if(!session || !isAdmin(session)) redirect('/cycles/active');
  const data = await getData(params.id);
  if(!data) return <div className='p-8'>Cycle not found.</div>;
  if(!['CLOSED','ARCHIVED'].includes(data.cycle.status)) return <div className='p-8'>Results available after cycle closes.</div>;
  const { cycle, items, users } = data;
  // Compute claimers per item
  const bidPairs = await prisma.bid.findMany({ where: { cycleId: cycle.id }, select: { itemId: true, userId: true } });
  const claimersMap = new Map();
  bidPairs.forEach(b => { if(!claimersMap.has(b.itemId)) claimersMap.set(b.itemId, new Set()); claimersMap.get(b.itemId).add(b.userId); });
  return (
    <div className='max-w-6xl mx-auto p-8 space-y-8'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <BackNav />
          <h1 className='text-xl font-semibold'>{cycle.name} Results</h1>
        </div>
        <div className='flex gap-2'>
          <Link href={`/api/admin/cycles/${cycle.id}/export`} className='text-xs px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200'>CSV</Link>
          <Link href={`/api/admin/cycles/${cycle.id}/export?format=xlsx`} className='text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white'>XLSX</Link>
          <Link href={`/api/admin/cycles/${cycle.id}/export?format=pdf`} className='text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white'>PDF</Link>
        </div>
      </div>
      <section className='space-y-2'>
        <h2 className='text-sm font-medium text-neutral-300'>Items Allocation</h2>
        <div className='overflow-x-auto border border-neutral-800 rounded'>
          <table className='w-full text-xs table-fixed'>
            <thead className='bg-neutral-800/60 text-neutral-400'>
              <tr><th className='px-2 py-1 text-left w-10'>#</th><th className='px-2 py-1 text-left'>Item</th><th className='px-2 py-1 text-right w-28'>Price (₦)</th><th className='px-2 py-1 text-right w-24'>Allocated</th><th className='px-2 py-1 text-right w-20'>Total</th><th className='px-2 py-1 text-right w-24'>% Filled</th><th className='px-2 py-1 text-right w-24'>Claimers</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (<tr><td colSpan={6} className='px-2 py-6 text-center text-neutral-500'>No items.</td></tr>)}
        {items.map((it,i)=>{ const allocated = it.allocatedQty; const pct = it.totalQty? Math.round((allocated/it.totalQty)*100):0; const claimers = claimersMap.get(it.id)?.size || 0; return (
                <tr key={it.id} className='border-t border-neutral-800'>
                  <td className='px-2 py-1 text-neutral-500'>{i+1}</td>
          <td className='px-2 py-1'>{it.name}</td>
          <td className='px-2 py-1 text-right'>{Number(it.price||0).toLocaleString('en-NG',{minimumFractionDigits:2})}</td>
                  <td className='px-2 py-1 text-right text-indigo-300 font-semibold'>{allocated}</td>
                  <td className='px-2 py-1 text-right'>{it.totalQty}</td>
                  <td className='px-2 py-1 text-right'>{pct}%</td>
                  <td className='px-2 py-1 text-right'>{claimers}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </section>
      <section className='space-y-2'>
  <h2 className='text-sm font-medium text-neutral-300'>Users (by total qty)</h2>
        <div className='overflow-x-auto border border-neutral-800 rounded'>
          <table className='w-full text-xs table-fixed'>
            <thead className='bg-neutral-800/60 text-neutral-400'><tr><th className='px-2 py-1 text-left w-10'>#</th><th className='px-2 py-1 text-left'>User</th><th className='px-2 py-1 text-right w-24'>Total Qty</th><th className='px-2 py-1 text-right w-32'>Total Value (₦)</th><th className='px-2 py-1 text-left'>Breakdown</th></tr></thead>
            <tbody>
              {users.length === 0 && (<tr><td colSpan={4} className='px-2 py-6 text-center text-neutral-500'>No bids placed.</td></tr>)}
        {users.map((u,i)=> (
                <tr key={u.email} className='border-t border-neutral-800'>
                  <td className='px-2 py-1 text-neutral-500'>{i+1}</td>
                  <td className='px-2 py-1'>{u.email}</td>
          <td className='px-2 py-1 text-right text-indigo-300 font-semibold'>{u.total}</td>
          <td className='px-2 py-1 text-right text-emerald-300 font-semibold'>{u.totalValue.toLocaleString('en-NG',{minimumFractionDigits:2})}</td>
          <td className='px-2 py-1'>{u.lines.map(l=>`${l.item}(${l.qty})`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
