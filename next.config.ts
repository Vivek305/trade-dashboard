import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by web.Dockerfile which copies .next/standalone + .next/static
  output: "standalone",
};

export default nextConfig;
