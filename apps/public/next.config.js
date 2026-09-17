/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
