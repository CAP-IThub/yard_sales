import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { itemUpdateSchema } from '@/lib/validators';

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const itemId = params.itemId;
  const data = await req.json();
  const parsed = itemUpdateSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', details: parsed.error.errors }, { status: 400 });
  const existing = await prisma.item.findUnique({ where: { id: itemId }, include: { cycle: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.cycle.status !== 'DRAFT') return NextResponse.json({ error: 'Can only edit items while cycle is DRAFT' }, { status: 400 });
  // If totalQty changes ensure not less than allocatedQty
  if (parsed.data.totalQty !== undefined && parsed.data.totalQty < existing.allocatedQty) {
    return NextResponse.json({ error: 'totalQty cannot be less than already allocated quantity' }, { status: 400 });
  }
  const updated = await prisma.item.update({ where: { id: itemId }, data: parsed.data });
  return NextResponse.json({ ...updated, price: updated.price != null ? Number(updated.price) : null });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const itemId = params.itemId;
  const existing = await prisma.item.findUnique({ where: { id: itemId }, include: { cycle: true, bids: { select: { id: true } } } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.cycle.status !== 'DRAFT') return NextResponse.json({ error: 'Can only delete items while cycle is DRAFT' }, { status: 400 });
  if (existing.bids.length > 0) return NextResponse.json({ error: 'Cannot delete item with bids' }, { status: 400 });
  await prisma.item.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
