import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { itemSchema } from '@/lib/validators';
import { roundPriceTwoDp } from '@/lib/money';

// Force dynamic to avoid caching and align with evolving Next.js param access semantics
export const dynamic = 'force-dynamic';


export async function GET(req, { params: paramsPromise }) {
  // In newer Next.js versions params may be a promise-like; always await
  const params = await paramsPromise;
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;
  const items = await prisma.item.findMany({ where: { cycleId }, orderBy: { createdAt: 'desc' } });
  const serialized = items.map(it => ({ ...it, price: it.price != null ? Number(it.price) : null }));
  return NextResponse.json(serialized);
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
  const price = roundPriceTwoDp(parsed.data.price);
  if(price === null) return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if (cycle.status !== 'DRAFT') return NextResponse.json({ error: 'Can only add items while cycle is DRAFT' }, { status: 400 });
  // Use explicit relation connect to avoid "Argument `cycle` is missing" if client expects nested relation
  const dataToCreate = { name, description, totalQty, price, cycle: { connect: { id: cycleId } } };
  // Explicitly set to null when blank so DB default does not override to 1
  dataToCreate.maxQtyPerUser = (maxQtyPerUser === undefined) ? null : maxQtyPerUser;
  const item = await prisma.item.create({ data: dataToCreate });
  return NextResponse.json({ ...item, price: item.price != null ? Number(item.price) : null }, { status: 201 });
}
