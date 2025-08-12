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

  // Perform all critical validation + mutation inside a single transaction with row locks / atomic updates
  const itemIds = selections.map(s => s.itemId);

  const result = await prisma.$transaction(async (tx) => {
    // Idempotency check (unique insert ensures atomicity)
    await tx.idempotency.create({ data: { key: idempotencyKey, userId: user.id } }).catch(() => { throw new Error('Duplicate request'); });

    // Lock items (FOR UPDATE) to prevent concurrent over-allocation
    const placeholders = itemIds.map(() => '?').join(',');
    const lockedItems = await tx.$queryRawUnsafe(`SELECT * FROM Item WHERE id IN (${placeholders}) FOR UPDATE`, ...itemIds);
    if (lockedItems.length !== itemIds.length) throw new Error('Some items not found');
    const cycleId = lockedItems[0].cycleId;
    if (!lockedItems.every(i => i.cycleId === cycleId)) throw new Error('Items from different cycles');

    // Lock cycle row to ensure status consistency
    const [lockedCycle] = await tx.$queryRawUnsafe(`SELECT * FROM Cycle WHERE id = ? FOR UPDATE`, cycleId);
    if (!lockedCycle) throw new Error('Cycle missing');
    if (lockedCycle.status !== 'OPEN') throw new Error('Cycle not open');

    // Lock existing user bids for this cycle (prevents race on per-user limits)
    const existingBids = await tx.$queryRawUnsafe(`SELECT * FROM Bid WHERE userId = ? AND cycleId = ? FOR UPDATE`, user.id, cycleId);
    const existingByItem = Object.fromEntries(existingBids.map(b => [b.itemId, b]));

    // Build item map for quick lookup
    const itemMap = Object.fromEntries(lockedItems.map(i => [i.id, i]));

    // Validate selections using locked state
    let totalQtyRequested = 0;
    for (const sel of selections) {
      if (sel.qty < 1) throw new Error('Invalid qty');
      const item = itemMap[sel.itemId];
      if (!item) throw new Error('Item mismatch');
      const existingUserQty = existingByItem[sel.itemId]?.qty || 0;
      if (existingUserQty + sel.qty > item.maxQtyPerUser) throw new Error(`Per-item limit for ${item.name}`);
      // We use an atomic conditional update below instead of checking allocatedQty here (to avoid TOCTOU)
      totalQtyRequested += sel.qty;
    }
    const userCycleTotal = existingBids.reduce((a,b)=>a+b.qty,0);
    if (userCycleTotal + totalQtyRequested > lockedCycle.maxItemsPerUser) throw new Error('Cycle max items per user exceeded');

    const updatedBids = [];
    // Apply each selection with atomic stock increment
    for (const sel of selections) {
      const item = itemMap[sel.itemId];
      const updatedRows = await tx.$executeRawUnsafe(
        `UPDATE Item SET allocatedQty = allocatedQty + ? WHERE id = ? AND allocatedQty + ? <= totalQty`,
        sel.qty, sel.itemId, sel.qty
      );
      if (updatedRows === 0) throw new Error(`Not enough remaining for ${item.name}`);
      // Upsert / increment bid quantity
      const existing = existingByItem[sel.itemId];
      if (existing) {
        const bid = await tx.bid.update({ where: { id: existing.id }, data: { qty: existing.qty + sel.qty } });
        existingByItem[sel.itemId] = bid; // update local
        updatedBids.push(bid);
      } else {
        const bid = await tx.bid.create({ data: { userId: user.id, itemId: sel.itemId, cycleId, qty: sel.qty } });
        existingByItem[sel.itemId] = bid;
        updatedBids.push(bid);
      }
    }
    return { bids: updatedBids, cycleId, itemIds };
  }).catch(e => ({ error: e.message || 'Transaction failed' }));

  if (result.error) {
    if (result.error === 'Duplicate request') return new Response(JSON.stringify({ error: 'Duplicate request' }), { status: 409 });
    return new Response(JSON.stringify({ error: result.error }), { status: 400 });
  }
  const freshItems = await prisma.item.findMany({ where: { id: { in: result.itemIds } } });
  return new Response(JSON.stringify({ bids: result.bids, items: freshItems }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
