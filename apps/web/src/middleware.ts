export { auth as middleware } from '@/auth';

export const config = {
  // Protect all routes except public ones
  matcher: [
    '/dashboard/:path*',
    '/trip/:path*',
  ],
};
