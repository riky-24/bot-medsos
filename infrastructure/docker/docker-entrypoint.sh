#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start application
echo "Starting application..."
exec npm run start:telegram
