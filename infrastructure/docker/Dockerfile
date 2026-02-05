FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk -U upgrade && apk add --no-cache openssl

WORKDIR /usr/src/app

# Install dependencies
COPY p*.json ./
COPY prisma ./prisma/

RUN npm ci && npx prisma generate

# Copy source code
COPY . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R node:node logs

# Security: Use non-root user
USER node

CMD ["/usr/src/app/infrastructure/docker/docker-entrypoint.sh"]
