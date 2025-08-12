import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Role & auth gate middleware
export async function middleware(req) {
  const { pathname, search } = req.nextUrl;

  // Skip public assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.(.*)$/)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Root or /login landing logic
  if (pathname === '/' || pathname === '/login') {
    if (token) {
      const url = req.nextUrl.clone();
      url.pathname = token.role === 'ADMIN' ? '/admin/cycles' : '/cycles/active';
      return NextResponse.redirect(url);
    }
    // unauthenticated: ensure user is on /login (canonical)
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // Admin section guard
  if (pathname.startsWith('/admin')) {
    if (!token) {
      const url = req.nextUrl.clone();
  url.pathname = '/login';
      url.search = `?callbackUrl=${encodeURIComponent(pathname + (search || ''))}`;
      return NextResponse.redirect(url);
    }
    if (token.role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/bids';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
  '/login',
    '/admin/:path*',
  '/bids',
  '/cycles/:path*'
  ]
};
