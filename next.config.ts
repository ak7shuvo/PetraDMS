import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Product screenshots are pre-optimised WebP files in /public/products.
  images: { unoptimized: true },
};

export default config;
