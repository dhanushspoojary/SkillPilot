/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  output: 'standalone',
  // Keep these as real node_modules in the standalone image so scripts/bootstrap-admin.mjs can import them.
  serverExternalPackages: ['bcryptjs', 'pg'],
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
      ],
    }];
  },
};
export default nextConfig;
