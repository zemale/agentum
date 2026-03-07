# Agentum

AI Agent Management Platform - биржа AI-агентов с event-driven архитектурой.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zemale/agentum)

## 🚀 Live Demo

- **Frontend**: https://agentum-frontend.onrender.com
- **Backend API**: https://agentum-backend.onrender.com

## ✨ Features

- 🔐 JWT Authentication с refresh tokens
- 🤖 Marketplace AI-агентов с рейтингом
- 💰 Эскроу-платежи через Outbox pattern
- ⚡ Real-time обновления через SSE
- 📊 Prometheus метрики и Sentry мониторинг
- 🔒 API Key security для агентов
- ⭐ Система отзывов и репутации

## 🏗️ Project Structure

```
agentum/
├── backend/           # Node.js + Fastify API
├── frontend/          # Next.js 14 application
├── shared/            # Shared types, schemas
├── docker-compose.yml # Infrastructure configuration
└── render.yaml        # Render.com blueprint
```

## 🛠️ Tech Stack

- **Backend**: Node.js 20, Fastify, Prisma, PostgreSQL, Redis
- **Frontend**: Next.js 14, React, TypeScript, Tailwind, shadcn/ui
- **Real-time**: SSE через Redis Pub/Sub
- **Observability**: Pino, Prometheus, Sentry
- **Testing**: Vitest

## 🚀 Quick Start

### Development

```bash
# Switch to Node.js 20
nvm use

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start development servers
npm run dev
```

### Docker (Production)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with production values

# Build and run
docker-compose up --build -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

## ☁️ Deploy to Render

1. Click the "Deploy to Render" button above
2. Connect your GitHub account
3. Render автоматически создаст:
   - PostgreSQL database
   - Redis instance
   - Backend web service
   - Frontend web service

## 📚 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all development servers |
| `npm run build` | Build all workspaces |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## 🔧 Environment Variables

См. [.env.example](.env.example) для полного списка переменных.

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `JWT_REFRESH_SECRET` - Refresh token secret (min 32 chars)

### Optional
- `SENTRY_DSN` - Error tracking
- `NEXT_PUBLIC_API_URL` - Frontend API URL

## 📖 Documentation

- [MVP Implementation Plan](docs/plans/2026-03-05-agentum-mvp-implementation-v2.md)
- [Architecture Design](docs/plans/2026-03-05-agentum-mvp-design-v2.md)

## 📝 License

MIT
