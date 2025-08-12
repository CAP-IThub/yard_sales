import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import BrandHeader from '@/components/BrandHeader';
import Link from 'next/link';
import ActiveCycleClient from './ActiveCycleClient';

export const dynamic = 'force-dynamic';

async function getOpenData(userId) {
  const cycles = await prisma.cycle.findMany({
    where: { status: 'OPEN' },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!userId) return cycles;
  // Fetch user's bids for these cycles/items
  const cycleIds = cycles.map(c=>c.id);
  if (cycleIds.length === 0) return cycles;
  const bids = await prisma.bid.findMany({ where: { userId, cycleId: { in: cycleIds } } });
  const byItem = new Map(bids.map(b=>[b.itemId, b.qty]));
  return cycles.map(c => ({
    ...c,
    items: c.items.map(it => ({ ...it, userQty: byItem.get(it.id) || 0 }))
  }));
}

export default async function ActiveCyclePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-center">Not authenticated. <a href="/login" className="underline text-blue-600">Login</a></div>;
  }
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  const cycles = await getOpenData(dbUser?.id);
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
  <BrandHeader subtitle="Active Cycles" right={<div className="flex items-center gap-3 text-xs"><Link href="/bids" className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200">My Bids</Link><span className="text-neutral-500">Africa/Lagos</span></div>} />
      {cycles.length === 0 && <div className="text-neutral-500 text-sm">No open cycles.</div>}
      {cycles.map(cycle => (
        <div key={cycle.id} className="border border-neutral-800 rounded-lg bg-neutral-900/60 backdrop-blur p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-neutral-100">{cycle.name}</h2>
              <div className="text-xs text-neutral-500">Max items/user: {cycle.maxItemsPerUser}</div>
            </div>
          </div>
          <ActiveCycleClient cycle={cycle} />
        </div>
      ))}
    </div>
  );
}
