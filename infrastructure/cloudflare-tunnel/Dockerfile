# Stage 1: Get binary from official image
FROM docker.io/cloudflare/cloudflared:latest AS src

# Stage 2: Final Alpine Image (Small & Secure)
FROM docker.io/alpine:latest

# Install dependencies (curl for healthcheck, ca-certificates for SSL)
RUN apk add --no-cache curl ca-certificates libc6-compat

# Create user
RUN adduser -D -u 1000 -h /home/nonroot nonroot

# Copy binary
COPY --from=src /usr/local/bin/cloudflared /usr/local/bin/cloudflared

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown nonroot:nonroot /entrypoint.sh

# Use non-root user
USER nonroot

ENTRYPOINT ["/entrypoint.sh"]
CMD ["tunnel", "run"]
