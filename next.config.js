/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Comprovantes de até 5 MB (fotos já chegam reduzidas pelo navegador).
    serverActions: { bodySizeLimit: '6mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
