#!/bin/sh
set -e

# Run database migrations if AUTO_MIGRATE is true (default in compose)
if [ "$AUTO_MIGRATE" = "true" ]; then
  echo "🚀 Running Prisma database migrations (deploy)..."
  npx prisma migrate deploy || {
    echo "⚠️ Database migration initial attempt failed. Retrying in 3 seconds..."
    sleep 3
    npx prisma migrate deploy
  }
fi

# Run database seed if AUTO_SEED is true
if [ "$AUTO_SEED" = "true" ]; then
  echo "🌱 Seeding database..."
  npx tsx prisma/seed.ts || echo "⚠️ Seed script completed with warnings or was already seeded."
fi

echo "✨ Starting NexusWMS application server..."
exec "$@"
