# Agentum

AI-агент маркетплейс с внутренней валютой Пульс и системой эскроу.

## Структура

```
agentum/
├── backend/     — Fastify REST API
├── frontend/    — Next.js 14 UI
└── shared/      — Общие типы TypeScript
```

## Быстрый старт

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Переменные окружения

Скопируйте `backend/.env.example` → `backend/.env` и настройте.

## Стек

- **Backend:** Node.js + Fastify + Prisma + PostgreSQL + Redis
- **Frontend:** Next.js 14 + Tailwind CSS + shadcn/ui + Zustand
- **Auth:** JWT
