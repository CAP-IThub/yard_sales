import { getServerSession } from "next-auth";
import { redirect } from 'next/navigation';
import { Fragment } from 'react';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import BrandHeader from "@/components/BrandHeader";
import CreateCycleClient from "./CreateCycleClient";
import CycleActionsClient from "./CycleActionsClient";
import ManageItemsClient from './ManageItemsClient';

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
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm overflow-hidden shadow divide-y divide-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800/70 text-neutral-300">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-10">#</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Max/User</th>
              <th className="px-3 py-2 font-medium">Open At</th>
              <th className="px-3 py-2 font-medium">Close At</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">No cycles yet.</td>
              </tr>
            )}
  {cycles.map((cycle, i) => {
              const statusColors = {
                DRAFT: 'bg-neutral-700 text-neutral-200',
                OPEN: 'bg-green-600/80 text-white',
                CLOSED: 'bg-red-600/80 text-white',
                ARCHIVED: 'bg-neutral-500/70 text-neutral-100'
              };
              return (
                <Fragment key={cycle.id}>
                <tr className={"border-t border-neutral-800 " + (i % 2 === 0 ? 'bg-neutral-900/50' : 'bg-neutral-900/30') }>
      <td className="px-3 py-2 text-neutral-500 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-neutral-200">{cycle.name}</td>
                  <td className="px-3 py-2"><span className={"inline-block px-2 py-1 rounded text-xs font-semibold " + statusColors[cycle.status]}>{cycle.status}</span></td>
                  <td className="px-3 py-2 text-neutral-300">{cycle.maxItemsPerUser}</td>
                  <td className="px-3 py-2 text-neutral-400">{cycle.openAt ? new Date(cycle.openAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '-'}</td>
                  <td className="px-3 py-2 text-neutral-400">{cycle.closeAt ? new Date(cycle.closeAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <CycleActionsClient cycle={cycle} />
                  </td>
                </tr>
                {cycle.status === 'DRAFT' && (
                  <tr className="border-t border-neutral-800">
                    <td colSpan={7} className="px-3 py-2">
                      {/* Items manager */}
                      <ManageItemsClient cycleId={cycle.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
