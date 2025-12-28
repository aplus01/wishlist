#!/bin/bash

# Deployment script for Wishlist App Backend
# Deploys backend to remote host (microbot)

set -e  # Exit on error

REMOTE_HOST="aaron@microbot"
REMOTE_PATH="/mnt/c/wishlist"  # Windows path on microbot
IMAGE_NAME="wishlist-backend:latest"

echo "========================================"
echo "Deploying Wishlist Backend"
echo "========================================"

# Build the backend image
echo ""
echo "📦 Building backend image..."
docker build -t $IMAGE_NAME ./backend

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Transfer image to remote host
echo ""
echo "🚀 Transferring image to $REMOTE_HOST..."
docker save $IMAGE_NAME | pv | ssh $REMOTE_HOST docker load

if [ $? -ne 0 ]; then
    echo "❌ Transfer failed!"
    exit 1
fi

echo "✅ Transfer complete!"

# Restart the container on remote
echo ""
echo "🔄 Restarting container on remote host..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker compose up -d --force-recreate backend"

if [ $? -ne 0 ]; then
    echo "❌ Container restart failed!"
    exit 1
fi

echo "✅ Container restarted!"

# Show container status
echo ""
echo "📊 Container status:"
ssh $REMOTE_HOST "docker ps --filter name=wishlist-backend"

echo ""
echo "========================================"
echo "✅ Deployment complete!"
echo "========================================"
echo ""
