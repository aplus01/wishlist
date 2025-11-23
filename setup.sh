#!/bin/bash

echo "🎄 Christmas Wishlist App - Setup Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found:${NC} $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm found:${NC} $(npm --version)"
echo ""

# Install frontend dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

echo ""

# Check if PocketBase is already downloaded
if [ -f ./pocketbase ]; then
    echo -e "${GREEN}✓ PocketBase binary found${NC}"
else
    echo -e "${BLUE}📥 Downloading PocketBase...${NC}"
    
    # Detect OS
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    if [ "$OS" = "Darwin" ]; then
        if [ "$ARCH" = "arm64" ]; then
            PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_darwin_arm64.zip"
        else
            PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_darwin_amd64.zip"
        fi
    elif [ "$OS" = "Linux" ]; then
        if [ "$ARCH" = "aarch64" ]; then
            PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_arm64.zip"
        else
            PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip"
        fi
    else
        echo -e "${RED}❌ Unsupported OS: $OS${NC}"
        echo "Please download PocketBase manually from https://pocketbase.io/docs/"
        exit 1
    fi
    
    curl -L $PB_URL -o pocketbase.zip
    unzip -q pocketbase.zip
    rm pocketbase.zip
    chmod +x pocketbase
    
    echo -e "${GREEN}✓ PocketBase downloaded${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start PocketBase:"
echo -e "   ${BLUE}./pocketbase serve${NC}"
echo ""
echo "2. Open PocketBase admin UI and import the schema:"
echo -e "   ${BLUE}http://127.0.0.1:8090/_/${NC}"
echo "   - Create an admin account"
echo "   - Go to Settings > Import collections"
echo "   - Upload pb_schema.json"
echo ""
echo "3. Create a parent user account:"
echo "   - In PocketBase admin, go to Collections > users"
echo "   - Click '+ New record'"
echo "   - Set role to 'parent'"
echo ""
echo "4. Start the frontend (in a new terminal):"
echo -e "   ${BLUE}npm run dev${NC}"
echo ""
echo "5. Open your browser:"
echo -e "   ${BLUE}http://localhost:3000${NC}"
echo ""
echo "📖 See README.md for detailed instructions"
