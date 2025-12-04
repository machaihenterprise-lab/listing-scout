import type { NextConfig } from "next";

// Force webpack (disable Turbopack) to avoid sandbox port-binding issues during build.
process.env.NEXT_DISABLE_TURBOPACK = "1";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
