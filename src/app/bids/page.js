import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import BackNav from "@/components/BackNav";

export const dynamic = 'force-dynamic';

async function getData(email) {
  if (!email) return { bids: [] };
  const bids = await prisma.bid.findMany({
    where: { user: { email } },
    include: { item: true, cycle: true },
    orderBy: { createdAt: 'desc' }
  });
  return { bids };
}

export default async function BidsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-center">Not authenticated. <Link className="text-blue-600 underline" href="/login">Login</Link></div>;
  }
  const { bids } = await getData(session.user.email);
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
  <BrandHeader prefix={<BackNav />} subtitle="Your Bid Activity" right={session.user.role === 'ADMIN' && <Link href="/admin/cycles" className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500">Admin</Link>} />
      {bids.length === 0 && <div className="text-neutral-500 text-sm">No bids yet.</div>}
      <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg bg-neutral-900/60 backdrop-blur">
        {bids.map((b, i) => (
          <li key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="font-medium text-neutral-100 flex items-center gap-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">{i+1}</span>{b.item.name}</div>
              <div className="text-xs text-neutral-500">Cycle: {b.cycle.name}</div>
            </div>
            <div className="text-sm text-blue-300 font-semibold">Qty: {b.qty}</div>
            <div className="text-xs text-neutral-500">{new Date(b.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
