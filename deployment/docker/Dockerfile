# =============================================================================
# IdaraOS - Multi-stage Dockerfile for Next.js 16+ with pnpm monorepo
# =============================================================================
# Build optimized for Azure Container Apps deployment
# Produces a minimal (~150MB) production image with standalone output
# =============================================================================
# Best Practices (2025):
# - Multi-stage builds for minimal production image
# - Layer caching: package files → install → source code → build
# - Packages installed during build (not runtime)
# - Rebuilding required when adding new packages (standard practice)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies - Install all dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for dependency installation
# This layer is cached unless package files change (optimal for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

# Install all dependencies
# This layer is cached unless package files change
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder - Build the application
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files first (for potential re-install if needed)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code last (changes frequently, doesn't invalidate dependency cache)
COPY apps/web ./apps/web

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the Next.js application (standalone output)
RUN pnpm --filter web build

# -----------------------------------------------------------------------------
# Stage 3: Runner - Production image
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set correct ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "apps/web/server.js"]
