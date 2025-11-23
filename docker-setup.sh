#!/bin/bash

echo "🎄 Christmas Wishlist - Docker Setup"
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}✓ Docker found:${NC} $(docker --version)"

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose found:${NC} $(docker compose --version)"
echo ""

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

echo -e "${GREEN}✓ Docker daemon is running${NC}"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

echo ""
echo -e "${BLUE}🏗️  Building Docker containers...${NC}"
echo "This may take a few minutes on first run..."
echo ""

docker compose build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo -e "${BLUE}🚀 Starting services...${NC}"
echo ""

docker compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start services${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Services started!${NC}"
echo ""
echo "Waiting for services to be ready..."
sleep 5

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Your Christmas Wishlist app is now running!"
echo ""
echo -e "${BLUE}📱 Access Points:${NC}"
echo "   • Frontend: ${GREEN}http://localhost${NC}"
echo "   • PocketBase Admin: ${GREEN}http://localhost/_/${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "   1. Open ${GREEN}http://localhost/_/${NC} in your browser"
echo "   2. Create a PocketBase admin account"
echo "   3. Go to Collections → users → New record"
echo "   4. Create a parent user (set role to 'parent')"
echo "   5. Visit ${GREEN}http://localhost${NC} and login!"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "   • View logs:        ${YELLOW}docker compose logs -f${NC}"
echo "   • Stop services:    ${YELLOW}docker compose down${NC}"
echo "   • Restart services: ${YELLOW}docker compose restart${NC}"
echo "   • Rebuild:          ${YELLOW}docker compose up -d --build${NC}"
echo ""
echo "   Or use Make commands:"
echo "   • ${YELLOW}make logs${NC}       - View all logs"
echo "   • ${YELLOW}make down${NC}       - Stop services"
echo "   • ${YELLOW}make restart${NC}    - Restart services"
echo "   • ${YELLOW}make backup${NC}     - Backup database"
echo "   • ${YELLOW}make help${NC}       - See all commands"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   • See ${GREEN}DOCKER.md${NC} for detailed Docker guide"
echo "   • See ${GREEN}README.md${NC} for app features and usage"
echo ""
echo -e "${GREEN}Happy gift planning! 🎁${NC}"
