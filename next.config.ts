import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  outputFileTracingExcludes: { "*": ["data/**", "models/**", "demo/**"] },
};

export default nextConfig;
