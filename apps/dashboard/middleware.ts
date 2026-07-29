import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirecionar /dashboard/* para /*
  if (request.nextUrl.pathname.startsWith('/dashboard/')) {
    const newPath = request.nextUrl.pathname.replace(/^\/dashboard/, '');
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  // Redirecionar /dashboard para /
  if (request.nextUrl.pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
