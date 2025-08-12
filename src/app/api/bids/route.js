import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { bidSubmitSchema } from '@/lib/validators';

// Simple in-memory rate limiter (per user/email) - resets on server restart.
const rateMap = new Map(); // key -> { count, ts }
const WINDOW_MS = 60_000; // 1 min
const MAX_REQ = 20; // 20 requests per minute

function checkRate(key) {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now - entry.ts > WINDOW_MS) {
    rateMap.set(key, { count: 1, ts: now });
    return true;
  }
  if (entry.count >= MAX_REQ) return false;
  entry.count += 1;
  return true;
}

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!checkRate('GET:' + session.user.email)) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get('cycleId') || undefined;
  const where = { user: { email: session.user.email } };
  if (cycleId) where.cycleId = cycleId;
  const bids = await prisma.bid.findMany({
    where,
    include: { item: true, cycle: true },
    orderBy: { createdAt: 'desc' }
  });
  return new Response(JSON.stringify({ bids }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!checkRate('POST:' + session.user.email)) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.isActive) return new Response(JSON.stringify({ error: 'Inactive user' }), { status: 403 });

  let body; try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }
  const parsed = bidSubmitSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid', details: parsed.error.errors }), { status: 400 });
  const { selections, idempotencyKey } = parsed.data;
  if (selections.length === 0) return new Response(JSON.stringify({ error: 'Empty selections' }), { status: 400 });

  const idem = await prisma.idempotency.findUnique({ where: { key: idempotencyKey } });
  if (idem) return new Response(JSON.stringify({ error: 'Duplicate request' }), { status: 409 });

  const itemIds = selections.map(s => s.itemId);
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } }, include: { cycle: true } });
  if (items.length !== itemIds.length) return new Response(JSON.stringify({ error: 'Some items not found' }), { status: 404 });
  const cycleId = items[0].cycleId;
  if (!items.every(i => i.cycleId === cycleId)) return new Response(JSON.stringify({ error: 'All items must be in same cycle' }), { status: 400 });
  const cycle = items[0].cycle;
  if (cycle.status !== 'OPEN') return new Response(JSON.stringify({ error: 'Cycle not open' }), { status: 400 });

  const existingBids = await prisma.bid.findMany({ where: { userId: user.id, cycleId } });
  const existingByItem = Object.fromEntries(existingBids.map(b => [b.itemId, b]));

  let totalQtyRequested = 0;
  for (const sel of selections) {
    const item = items.find(i => i.id === sel.itemId);
    if (!item) return new Response(JSON.stringify({ error: 'Item mismatch' }), { status: 400 });
    if (sel.qty < 1) return new Response(JSON.stringify({ error: 'Invalid qty' }), { status: 400 });
    const existingUserQty = existingByItem[sel.itemId]?.qty || 0;
    if (existingUserQty + sel.qty > item.maxQtyPerUser) return new Response(JSON.stringify({ error: `Exceeds per-item limit for ${item.name}` }), { status: 400 });
    if (item.allocatedQty + sel.qty > item.totalQty) return new Response(JSON.stringify({ error: `Not enough remaining for ${item.name}` }), { status: 400 });
    totalQtyRequested += sel.qty;
  }
  const userCycleTotal = existingBids.reduce((a,b)=>a+b.qty,0);
  if (userCycleTotal + totalQtyRequested > cycle.maxItemsPerUser) return new Response(JSON.stringify({ error: 'Cycle max items per user exceeded' }), { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    await tx.idempotency.create({ data: { key: idempotencyKey, userId: user.id } });
    const updatedBids = [];
    for (const sel of selections) {
      const item = items.find(i => i.id === sel.itemId);
      const fresh = await tx.item.findUnique({ where: { id: item.id } });
      if (!fresh) throw new Error('Item disappeared');
      if (fresh.allocatedQty + sel.qty > fresh.totalQty) throw new Error(`Not enough remaining for ${item.name}`);
      await tx.item.update({ where: { id: item.id }, data: { allocatedQty: { increment: sel.qty } } });
      const bid = await tx.bid.upsert({
        where: { userId_itemId_cycleId: { userId: user.id, itemId: item.id, cycleId } },
        create: { userId: user.id, itemId: item.id, cycleId, qty: sel.qty },
        update: { qty: { increment: sel.qty } }
      });
      updatedBids.push(bid);
    }
    return updatedBids;
  }).catch(e => ({ error: e.message || 'Transaction failed' }));

  if (Array.isArray(result)) {
    const freshItems = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    return new Response(JSON.stringify({ bids: result, items: freshItems }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else {
    if (result.error.includes('Unique constraint')) return new Response(JSON.stringify({ error: 'Duplicate request' }), { status: 409 });
    return new Response(JSON.stringify(result), { status: 400 });
  }
}
