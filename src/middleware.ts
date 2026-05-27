import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only routes
    if (path.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Accounting-only write operations (GET is fine for all authenticated)
    // Protect API sync routes from readonly users
    if ((path.startsWith('/api/sync') || path.startsWith('/api/airtable')) && req.method !== 'GET') {
      if (token?.role === 'readonly') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        const internalToken = req.headers.get('x-internal-token');
        const expectedInternalToken = process.env.INTERNAL_API_TOKEN;

        if (
          (path.startsWith('/api/sync') || path.startsWith('/api/airtable')) &&
          expectedInternalToken &&
          internalToken === expectedInternalToken
        ) {
          return true;
        }

        if (
          path.startsWith('/login') ||
          path.startsWith('/brand/') ||
          path.startsWith('/api/health') ||
          path.startsWith('/api/webhooks')
        ) {
          return true;
        }
        // All other paths require auth
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
