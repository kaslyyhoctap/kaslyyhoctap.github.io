/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is default in Next.js 16 for dev and build
  // Image domains for external images (add your CDN domains here)
  images: {
    remotePatterns: [{ hostname: '**.googleusercontent.com' }],
  },
  // External packages that should not be bundled by the bundler
  serverExternalPackages: ['@neondatabase/serverless', 'drizzle-orm'],
};

module.exports = nextConfig;
