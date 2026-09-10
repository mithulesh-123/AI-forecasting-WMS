# ===========================================================================
# Stage 1: Base image with system dependencies
# ===========================================================================
FROM node:20-alpine AS base

# Install libc6-compat and openssl (required by Prisma engine on Alpine)
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# ===========================================================================
# Stage 2: Install dependencies
# ===========================================================================
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

# ===========================================================================
# Stage 3: Build application
# ===========================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client & build Next.js with standalone output
RUN npx prisma generate
RUN npm run build

# ===========================================================================
# Stage 4: Production Runner
# ===========================================================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and public directory
COPY --from=builder /app/public ./public

# Set permissions for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone build output and static bundles
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations for db migrate/seed support
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy node_modules with Prisma CLI & TSX for runtime migrations/seeds
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
CMD ["node", "server.js"]
