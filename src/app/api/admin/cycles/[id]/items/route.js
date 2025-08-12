import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { itemSchema } from '@/lib/validators';

// Force dynamic to avoid caching and align with evolving Next.js param access semantics
export const dynamic = 'force-dynamic';

export async function GET(req, { params: paramsPromise }) {
  // In newer Next.js versions params may be a promise-like; always await
  const params = await paramsPromise;
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;
  const items = await prisma.item.findMany({ where: { cycleId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(items);
}

export async function POST(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;
  const data = await req.json();
  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', details: parsed.error.errors }, { status: 400 });
  const { name, description, totalQty, maxQtyPerUser } = parsed.data;
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if (cycle.status !== 'DRAFT') return NextResponse.json({ error: 'Can only add items while cycle is DRAFT' }, { status: 400 });
  const item = await prisma.item.create({ data: { cycleId, name, description, totalQty, maxQtyPerUser } });
  return NextResponse.json(item, { status: 201 });
}
