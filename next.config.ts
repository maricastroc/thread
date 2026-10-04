import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: { "*": ["demo/archive/**"] },
  outputFileTracingExcludes: { "*": ["data/**", "models/**", "demo/audio/**", "fixtures/**"] },
};

export default nextConfig;
