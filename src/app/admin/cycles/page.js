import { getServerSession } from "next-auth";
import { redirect } from 'next/navigation';
import { Fragment } from 'react';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import BrandHeader from "@/components/BrandHeader";
import CreateCycleClient from "./CreateCycleClient";
import CyclesTableClient from './CyclesTableClient';

export default async function AdminCyclesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!isAdmin(session)) redirect('/cycles/active');

  const cycles = await prisma.cycle.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
	<BrandHeader subtitle="Admin Cycles" right={<CreateCycleClient />} />
      <CyclesTableClient cycles={cycles} />
    </div>
  );
}
