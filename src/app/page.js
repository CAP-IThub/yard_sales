import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  redirect(session.user.role === 'ADMIN' ? '/admin/cycles' : '/cycles/active');
}
