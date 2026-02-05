# Stage 1: Builder
FROM node:20-alpine AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /usr/src/app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install all dependencies (including dev) to run build/migration scripts if needed
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install OpenSSL for Prisma (runtime dependency)
RUN apk add --no-cache openssl

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy only necessary files from builder
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/server ./server
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/infrastructure/docker/docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure rights for the entrypoint
RUN chmod +x ./docker-entrypoint.sh

# Set correct permissions for Next.js (if used) or just general app directory
# RUN chown -R nestjs:nodejs /usr/src/app

USER nestjs

# Expose the port the app runs on
EXPOSE 3000

# Let NODE_ENV be controlled by docker-compose or the container runtime
# ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
