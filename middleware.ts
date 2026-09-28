import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

/**
 * Route guard.
 *
 * This is a redirect for convenience, not a security boundary — the real checks
 * are on the backend, which validates the token and the tenant on every call.
 * Its job is to stop an unauthenticated visitor landing on an empty dashboard
 * that flashes before erroring.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get('mprnt_rt')?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where they were heading so sign-in can return them there.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
