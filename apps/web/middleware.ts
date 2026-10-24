import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest) {
  const n = nonce();
  const prod = process.env.NODE_ENV === 'production';
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${n}' 'strict-dynamic'${prod ? '' : " 'unsafe-eval'"}`,
    "connect-src 'self'",
    "font-src 'self' data:",
    ...(prod && process.env.SKILLPILOT_SECURE_COOKIES !== 'false' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', n);
  // Next.js reads the nonce from the REQUEST CSP header and stamps it on its own inline scripts.
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png).*)'] };
