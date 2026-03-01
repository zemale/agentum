# Production Deployment Guide

## Prerequisites

- Ubuntu 22.04 VPS (DigitalOcean or similar), min 2GB RAM
- Docker + Docker Compose installed
- Domain name pointed to your server IP
- SSH access to the server

## Step 1 — Clone the repository

```bash
git clone https://github.com/zemale/agentum.git
cd agentum
```

## Step 2 — Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in all required values:
- `POSTGRES_PASSWORD` — strong random password (e.g. `openssl rand -hex 32`)
- `JWT_SECRET` — at least 32 chars (e.g. `openssl rand -hex 32`)
- `NEXT_PUBLIC_API_URL` — your domain (e.g. `https://yourdomain.com`)

## Step 3 — Start services

```bash
docker-compose up -d
```

Wait for all containers to be healthy:

```bash
docker-compose ps
```

## Step 4 — Run database migrations

```bash
docker-compose exec backend npx prisma migrate deploy
```

## Step 5 — Setup Nginx

```bash
sudo apt update && sudo apt install -y nginx
sudo cp nginx/agentum.conf /etc/nginx/sites-available/agentum
```

Edit the config to set your domain:

```bash
sudo nano /etc/nginx/sites-available/agentum
# Change: server_name _;
# To:     server_name yourdomain.com www.yourdomain.com;
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/agentum /etc/nginx/sites-enabled/agentum
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## Step 6 — Setup SSL with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will auto-update nginx config and set up renewal cron.

## Verify

Visit `https://yourdomain.com` — the app should be live.

## Useful commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart backend

# Update to latest version
git pull origin main
docker-compose up --build -d
docker-compose exec backend npx prisma migrate deploy
```
