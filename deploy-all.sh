#!/bin/bash

# Full deployment script for Wishlist App
# Deploys both frontend and backend to remote host (microbot)

set -e  # Exit on error

REMOTE_HOST="aaron@microbot"
REMOTE_PATH="c:\\wishlist"  # Windows path on microbot

echo "========================================"
echo "Deploying Full Wishlist App"
echo "========================================"

# Build all images
echo ""
echo "📦 Building all images..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Transfer backend image
echo ""
echo "🚀 Transferring backend image to $REMOTE_HOST..."
docker save wishlist-backend:latest | pv | ssh $REMOTE_HOST docker load

# Transfer frontend image
echo ""
echo "🚀 Transferring frontend image to $REMOTE_HOST..."
docker save wishlist-frontend:latest | pv | ssh $REMOTE_HOST docker load

echo "✅ Transfer complete!"

# Restart all containers on remote
echo ""
echo "🔄 Restarting all containers on remote host..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose up -d --force-recreate"

if [ $? -ne 0 ]; then
    echo "❌ Container restart failed!"
    exit 1
fi

echo "✅ Containers restarted!"

# Show container status
echo ""
echo "📊 Container status:"
ssh $REMOTE_HOST "docker ps --filter name=wishlist"

echo ""
echo "========================================"
echo "✅ Full deployment complete!"
echo "========================================"
echo ""
echo "🌐 App should be available at: http://microbot"
echo "🔧 Backend API: http://microbot:8090"
echo ""
