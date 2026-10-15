// Next.js config (CommonJS) to avoid ESM/CJS interop issues in TS config
// and to explicitly set Turbopack root for this app within the monorepo.
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Use this app directory as the root so Turbopack doesn't infer the repo root
    root: __dirname,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
