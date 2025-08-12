import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // List OPEN cycles with their items (only basic fields)
  const cycles = await prisma.cycle.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });
  return NextResponse.json(cycles);
}
