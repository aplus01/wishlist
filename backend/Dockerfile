FROM alpine:latest

# Install dependencies
RUN apk add --no-cache \
    ca-certificates \
    unzip \
    curl

WORKDIR /app

# Download PocketBase
ARG POCKETBASE_VERSION=0.22.0
RUN curl -L "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip" -o pocketbase.zip \
    && unzip pocketbase.zip \
    && rm pocketbase.zip \
    && chmod +x pocketbase

# Copy schema and migrations
COPY pb_schema.json ./
COPY pb_migrations ./pb_migrations/

# Expose PocketBase port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8090/api/health || exit 1

# Start PocketBase
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
