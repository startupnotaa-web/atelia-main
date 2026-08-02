import type { NextConfig } from "next";

import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  transpilePackages: [
    'firebase-admin',
    'jwks-rsa',
    'jose',
    'jsonwebtoken'
  ],
  turbopack: {},
};

export default withPWA(nextConfig);
