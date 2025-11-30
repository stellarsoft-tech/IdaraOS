import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  // This creates a minimal production build with all dependencies bundled
  output: "standalone",

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable strict mode for better error catching
  reactStrictMode: true,

  // Configure allowed image domains if needed
  images: {
    remotePatterns: [
      // Add external image domains here if needed
      // { protocol: 'https', hostname: 'example.com' },
    ],
  },

  // Environment variables available at build time
  env: {
    // Add build-time env vars here if needed
  },
};

export default nextConfig;
