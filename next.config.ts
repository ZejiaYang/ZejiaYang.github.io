import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Imported CSS can remain stale in the dev cache after dependency reinstalls.
  experimental: { turbopackFileSystemCacheForDev: false },
};

export default nextConfig;
