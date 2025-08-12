import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const bids = await prisma.bid.findMany({
    where: { user: { email: session.user.email } },
    include: { item: true, cycle: true },
    orderBy: { createdAt: 'desc' }
  });
  return new Response(JSON.stringify({ bids }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
