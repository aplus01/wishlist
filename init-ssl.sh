#!/bin/bash

# SSL initialization script for Let's Encrypt with Docker
# Run this ONCE on the remote server to obtain initial certificates

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" = "your-domain.ddns.net" ]; then
    echo "ERROR: Please set DOMAIN_NAME in .env file"
    exit 1
fi

if [ -z "$LETSENCRYPT_EMAIL" ] || [ "$LETSENCRYPT_EMAIL" = "your-email@example.com" ]; then
    echo "ERROR: Please set LETSENCRYPT_EMAIL in .env file"
    exit 1
fi

echo "========================================"
echo "Initializing SSL for: $DOMAIN_NAME"
echo "Email: $LETSENCRYPT_EMAIL"
echo "========================================"

# Create required directories
mkdir -p ./certbot-www
mkdir -p ./certs

# Step 1: Update nginx.conf with actual domain
echo "Updating nginx.conf with domain..."
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN_NAME/g" frontend/nginx.conf

# Step 2: Create a temporary nginx config for initial cert request
echo "Creating temporary nginx config for certificate request..."
cat > frontend/nginx.conf.tmp << 'EOF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

# Step 3: Start nginx with temporary config
echo "Starting nginx with temporary config..."
docker run -d --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/frontend/nginx.conf.tmp:/etc/nginx/conf.d/default.conf:ro \
    -v $(pwd)/certbot-www:/var/www/certbot \
    nginx:alpine

# Wait for nginx to start
sleep 3

# Step 4: Request certificate
echo "Requesting SSL certificate from Let's Encrypt..."
docker run --rm \
    -v $(pwd)/certs:/etc/letsencrypt \
    -v $(pwd)/certbot-www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $LETSENCRYPT_EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN_NAME

# Step 5: Stop temporary nginx
echo "Stopping temporary nginx..."
docker stop nginx-temp
docker rm nginx-temp

# Step 6: Clean up temporary config
rm frontend/nginx.conf.tmp

# Step 7: Copy certs to docker volume location
echo "Setting up certificate volumes..."

echo ""
echo "========================================"
echo "SSL certificate obtained successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Deploy your app with: ./deploy-all.sh"
echo "2. Your site will be available at: https://$DOMAIN_NAME"
echo ""
echo "Certificates will auto-renew via the certbot container."
echo ""
