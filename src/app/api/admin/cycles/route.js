import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/rbac";
import { cycleSchema, cycleUpdateSchema } from "@/lib/validators";

// GET /api/admin/cycles - list cycles
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cycles = await prisma.cycle.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(cycles);
}

// POST /api/admin/cycles - create cycle
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await req.json();
  const parse = cycleSchema.safeParse(data);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid data", details: parse.error.errors }, { status: 400 });
  }
  const { name, maxItemsPerUser, openAt, closeAt } = parse.data;
  const cycle = await prisma.cycle.create({
    data: {
      name,
      maxItemsPerUser,
      openAt,
      closeAt,
    },
  });
  return NextResponse.json(cycle, { status: 201 });
}

// PATCH /api/admin/cycles?id=cycleId - update or transition status
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const data = await req.json().catch(() => ({}));
  const parse = cycleUpdateSchema.safeParse(data);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid data', details: parse.error.errors }, { status: 400 });
  }
  const cycle = await prisma.cycle.findUnique({ where: { id } });
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let update = {};
  if (parse.data.name) update.name = parse.data.name;
  if (parse.data.maxItemsPerUser) update.maxItemsPerUser = parse.data.maxItemsPerUser;
  if (parse.data.action === 'OPEN') {
    if (cycle.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT cycles can be opened' }, { status: 400 });
    update.status = 'OPEN';
    update.openAt = new Date();
  }
  if (parse.data.action === 'CLOSE') {
    if (cycle.status !== 'OPEN') return NextResponse.json({ error: 'Only OPEN cycles can be closed' }, { status: 400 });
    update.status = 'CLOSED';
    update.closeAt = new Date();
  }
  const updated = await prisma.cycle.update({ where: { id }, data: update });
  return NextResponse.json(updated);
}
