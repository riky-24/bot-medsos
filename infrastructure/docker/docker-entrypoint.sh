#!/bin/sh
set -e

# Log function for consistent output
log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
}

log "Starting entrypoint script..."

# Wait for database if needed (Prisma might handle this, but good to be safe)
# In production, the healthcheck in docker-compose handles this.

# Run migrations
if [ -n "$DATABASE_URL" ]; then
    log "Running database migrations..."
    if ! npx prisma migrate deploy; then
        log "ERROR: Migration failed!"
        exit 1
    fi
    log "Migrations completed successfully."
else
    log "WARNING: DATABASE_URL is not set. Skipping migrations."
fi

# Start application
log "Starting application with npm run start:telegram..."
exec npm run start:telegram
