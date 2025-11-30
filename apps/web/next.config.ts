import type { NextConfig } from "next";

// Content Security Policy directives
// Adjust these based on your security requirements
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Scripts: self + unsafe-inline/eval for Next.js hydration + Vercel Analytics + Azure AD
  // Note: 'self' covers _vercel paths, but we also allow Vercel domains explicitly
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://vercel-insights.com https://*.vercel-insights.com https://*.vercel.com https://login.microsoftonline.com https://*.login.microsoftonline.com",
  // Styles: self + unsafe-inline for styled-components/emotion/tailwind
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Images: self + data URIs + HTTPS for external images
  "img-src 'self' data: https: blob:",
  // Fonts: self + data URIs + Google Fonts
  "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
  // Connect: self + Microsoft (Azure AD) + Vercel Analytics + HTTPS for API calls
  "connect-src 'self' https://login.microsoftonline.com https://*.login.microsoftonline.com https://graph.microsoft.com https://vercel-insights.com https://*.vercel-insights.com https://*.vercel.com https://vitals.vercel-insights.com https:",
  // Frame: Allow Microsoft login popups
  "frame-src 'self' https://login.microsoftonline.com https://*.login.microsoftonline.com",
  // Frame ancestors: Only same origin (prevents clickjacking)
  "frame-ancestors 'self'",
  // Object: Disallow plugins (Flash, Java, etc.)
  "object-src 'none'",
  // Base URI: Restrict to self (prevents base tag injection)
  "base-uri 'self'",
  // Form actions: Restrict to self + Microsoft for SSO
  "form-action 'self' https://login.microsoftonline.com https://*.login.microsoftonline.com",
].join("; ");

// Security headers configuration
const securityHeaders = [
  {
    // DNS prefetch for performance
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    // HSTS: Force HTTPS for 2 years, include subdomains, allow preload list
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Prevent clickjacking by only allowing same-origin framing
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Prevent MIME type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // XSS protection (legacy browsers)
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // Control referrer information sent with requests
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict browser features/APIs
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Content Security Policy
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
];

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

  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Rewrites for SCIM endpoint case sensitivity
  // Azure AD expects /Users (capital U) but Next.js routes use lowercase
  async rewrites() {
    return [
      {
        source: "/api/scim/v2/Users",
        destination: "/api/scim/v2/users",
      },
      {
        source: "/api/scim/v2/Users/:id",
        destination: "/api/scim/v2/users/:id",
      },
    ];
  },
};

export default nextConfig;
