import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export → `next build` emits plain HTML/CSS/JS into `out/`.
  output: "export",

  // Emit /blog/index.html instead of /blog.html — works everywhere on
  // GitHub Pages, including client-side navigation.
  trailingSlash: true,

  // The default image optimizer needs a server; static hosts can't run it.
  images: { unoptimized: true },

  // Set automatically by the deploy workflow for project-page repos
  // (e.g. /personal-site). Empty for <user>.github.io repos and local dev.
  basePath: process.env.NEXT_BASE_PATH || undefined,
};

export default nextConfig;
