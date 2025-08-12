import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/rbac";
import { cycleSchema } from "@/lib/validators";

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
