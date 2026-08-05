import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // serverActions �?Next 15 默认启用
  },
};

export default nextConfig;
