import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  // This creates a minimal production build with all dependencies bundled
  // 
  // WINDOWS USERS: If you get EPERM symlink errors, you have two options:
  // 1. Enable Developer Mode: Settings > Privacy & Security > For developers > Developer Mode
  // 2. Disable standalone for local builds: Set ENABLE_STANDALONE=false environment variable
  //    Example: $env:ENABLE_STANDALONE="false"; pnpm build
  output: process.env.ENABLE_STANDALONE === "false" ? undefined : "standalone",

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
