import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';

// GET aggregated results for a CLOSED or ARCHIVED cycle
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if(!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if(!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if(!['CLOSED','ARCHIVED'].includes(cycle.status)) return NextResponse.json({ error: 'Results only available after cycle is closed' }, { status: 400 });

  const items = await prisma.item.findMany({ where: { cycleId }, orderBy: { createdAt: 'asc' } });
  const bids = await prisma.bid.findMany({ where: { cycleId }, include: { user: true, item: true } });

  // Group per item
  const perItem = items.map(item => {
    const itemBids = bids.filter(b => b.itemId === item.id);
    const totalAllocated = item.allocatedQty; // consistent with transactional allocation
    return {
      id: item.id,
      name: item.name,
      totalQty: item.totalQty,
      allocatedQty: item.allocatedQty,
      userCount: itemBids.length,
      bids: itemBids.map(b => ({ id: b.id, userEmail: b.user.email, qty: b.qty, createdAt: b.createdAt }))
    };
  });

  // Per user summary
  const perUserMap = new Map();
  bids.forEach(b => {
    const key = b.userId;
    if(!perUserMap.has(key)) perUserMap.set(key, { userEmail: b.user.email, totalQty: 0, items: [] });
    const u = perUserMap.get(key);
    u.totalQty += b.qty;
    u.items.push({ itemName: b.item.name, qty: b.qty });
  });
  const users = Array.from(perUserMap.values()).sort((a,b)=>b.totalQty - a.totalQty);

  return NextResponse.json({ cycle: { id: cycle.id, name: cycle.name, status: cycle.status }, items: perItem, users });
}
