import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PostLogin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }
  const role = session.user.role;
  if (role === 'ADMIN') redirect('/admin/cycles');
  redirect('/cycles/active');
}
