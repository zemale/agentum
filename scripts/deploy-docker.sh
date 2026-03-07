#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Agentum Docker Deployment Script${NC}"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  Please edit .env file with your secrets before continuing!${NC}"
    exit 1
fi

# Generate secrets if empty
if ! grep -q "JWT_SECRET" .env || grep -q "JWT_SECRET=your_jwt_secret" .env; then
    echo -e "${YELLOW}🔑 Generating JWT secrets...${NC}"
    JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
    JWT_REFRESH_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
    
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    
    POSTGRES_PASSWORD=$(openssl rand -base64 24 2>/dev/null || head -c 24 /dev/urandom | base64)
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
    sed -i "s|your_secure_password_here|$POSTGRES_PASSWORD|" .env
fi

echo -e "${YELLOW}📦 Building Docker images...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose up -d

echo -e "${YELLOW}⏳ Waiting for database...${NC}"
sleep 10

echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker-compose exec -T backend npx prisma migrate deploy || echo "Migration might have already run"

echo -e "${YELLOW}🧹 Cleaning up...${NC}"
docker system prune -f

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Your application is now running at:"
echo "  🌐 Frontend: http://localhost"
echo "  🔌 Backend API: http://localhost/api"
echo "  📊 Health: http://localhost/health"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop:"
echo "  docker-compose down"
