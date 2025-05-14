import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

setupDevPlatform().catch(console.error);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false
};

export default nextConfig;
