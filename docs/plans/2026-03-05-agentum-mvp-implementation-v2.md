# Agentum MVP — Implementation Plan v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Рабочий MVP биржи AI-агентов Agentum с event-driven архитектурой, Outbox pattern, SSE real-time, observability и безопасностью.

**Architecture:** Node.js + Fastify, PostgreSQL + Prisma, Redis (Pub/Sub + Streams), Next.js 14, structured logging, Prometheus metrics.

**Design doc:** `docs/plans/2026-03-05-agentum-mvp-design-v2.md`

---

## Phase 1: Project Setup & Foundation

### Task 1.1 — Init monorepo with structure
- Создать структуру: `agentum/backend/`, `agentum/frontend/`, `agentum/shared/`
- Init `package.json` в каждой папке, настроить workspaces
- Создать `.gitignore`, `README.md`, `.nvmrc` (Node 20)
- Настроить ESLint, Prettier с единым конфигом
- Commit: `chore: init monorepo structure`

### Task 1.2 — Backend: Fastify + TypeScript + OpenAPI
- `cd backend && npm init -y`
- Установить: `fastify`, `@fastify/jwt`, `@fastify/cors`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-plugin`, `fastify-zod`
- Установить dev: `typescript`, `tsx`, `nodemon`, `@types/node`, `vitest`, `supertest`
- Создать `src/index.ts` — базовый Fastify сервер на порту 3001
- Настроить `@fastify/swagger` с автогенерацией OpenAPI 3.0
- Написать тест: `GET /health` возвращает `{ status: 'ok' }`
- Реализовать `/health` endpoint
- Запустить тест — убедиться что проходит
- Commit: `feat: init fastify backend with openapi`

### Task 1.3 — Backend: Structured Logging (Pino)
- Установить: `pino`, `pino-pretty`
- Создать `src/lib/logger.ts` — конфигурация Pino с trace_id
- Добавить автоматическое логирование всех запросов с timing
- Добавить correlation_id middleware
- Написать тест: лог содержит trace_id, method, url, status, duration
- Commit: `feat: add structured logging with pino`

### Task 1.4 — Backend: PostgreSQL + Prisma + Soft Delete
- Установить: `prisma`, `@prisma/client`
- `npx prisma init`
- Настроить `DATABASE_URL` в `.env`
- Создать базовую схему: `User`, `Agent`, `Task`, `Transaction`, `Outbox` с `deletedAt` полями
- Добавить Prisma middleware для soft delete (авто-фильтрация `deletedAt: null`)
- Создать `src/lib/prisma.ts` — singleton клиент
- `npx prisma migrate dev --name init`
- Написать тест: удаление записи ставит `deletedAt`, findMany не возвращает удалённые
- Commit: `feat: add prisma schema with soft delete`

### Task 1.5 — Backend: Redis (Pub/Sub + Streams)
- Установить: `ioredis`
- Создать `src/lib/redis.ts` — клиент с поддержкой Pub/Sub и Streams
- Написать тест: ping Redis возвращает PONG, Pub/Sub работает
- Commit: `feat: add redis client`

### Task 1.6 — Backend: Validation (Zod)
- Установить: `zod`, `fastify-zod`
- Создать `src/lib/validation.ts` — общие схемы
- Создать `shared/schemas/` — shared Zod схемы для backend/frontend
- Настроить автоматическую валидацию через Fastify
- Commit: `feat: add zod validation`

### Task 1.7 — Frontend: Next.js 14 + shadcn/ui
- `npx create-next-app@14 frontend --typescript --tailwind --app --no-turbopack`
- Установить: `shadcn-ui@latest`, `zustand`, `swr`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`, `zod`
- Инициализировать shadcn: `npx shadcn-ui@latest init`
- Установить базовые компоненты: `button`, `input`, `card`, `dialog`, `toast`
- Настроить axios instance с interceptors для JWT refresh
- Убедиться что `npm run dev` запускается без ошибок
- Commit: `feat: init next.js 14 frontend`

---

## Phase 2: Observability & Infrastructure

### Task 2.1 — Backend: Health Checks Deep
- Создать `src/routes/health.ts` с endpoint'ами:
  - `GET /health` — базовый статус
  - `GET /health/db` — проверка PostgreSQL (SELECT 1)
  - `GET /health/redis` — проверка Redis (PING)
- Написать тесты для каждого endpoint
- Commit: `feat: add deep health checks`

### Task 2.2 — Backend: Prometheus Metrics
- Установить: `prom-client`, `@fastify/metrics`
- Настроить `/metrics` endpoint
- Добавить кастомные метрики:
  - `http_requests_total` — счётчик по методам/статусам
  - `http_request_duration_seconds` — гистограмма latency
- Написать тест: метрики экспортируются
- Commit: `feat: add prometheus metrics`

### Task 2.3 — Backend: Error Tracking (Sentry)
- Установить: `@sentry/node`, `@sentry/profiling-node`
- Создать `src/lib/sentry.ts` — инициализация Sentry
- Настроить captureException для всех ошибок
- Добавить Sentry DSN в `.env`
- Написать тест: ошибка отправляется в Sentry
- Commit: `feat: add sentry error tracking`

### Task 2.4 — Backend: Rate Limiting
- Установить: `@fastify/rate-limit`
- Настроить глобальный rate limit: 100 req/min для авторизованных, 30 для анонимов
- Добавить Redis store для rate limiting (distributed)
- Написать тест: превышение лимита → 429 Too Many Requests
- Commit: `feat: add rate limiting`

### Task 2.5 — Backend: Idempotency Middleware
- Создать `src/plugins/idempotency.ts`
- Хранить idempotency keys в Redis (TTL 24h)
- При повторном запросе с тем же ключом — вернуть cached response
- Написать тест: повторный POST с тем же ключом → тот же результат
- Commit: `feat: add idempotency middleware`

---

## Phase 3: Auth System (JWT + Security)

### Task 3.1 — Prisma schema: User with refresh tokens
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String    // hashed bcrypt
  name          String
  balance       Int       @default(1000)
  frozen        Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  
  refreshTokens RefreshToken[]
  agents        Agent[]
  tasksAsCustomer Task[] @relation("CustomerTasks")
  transactions  Transaction[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```
- Мигрировать
- Commit: `feat: add user model with refresh tokens`

### Task 3.2 — Backend: Register endpoint with validation
- Написать тест: `POST /auth/register` с email+password+name → возвращает accessToken, refreshToken, user
- Тест падает
- Реализовать endpoint:
  - Валидация Zod (email, password min 8 chars, name)
  - Хэш пароля bcrypt (10 rounds)
  - Создать User с 1000 Пульсов
  - Создать RefreshToken (TTL 30 дней)
  - Вернуть JWT (access TTL 15 мин)
- Тест проходит
- Commit: `feat: add register endpoint`

### Task 3.3 — Backend: Login endpoint
- Написать тест: `POST /auth/login` → accessToken, refreshToken
- Тест падает
- Реализовать endpoint с проверкой bcrypt
- Тест проходит
- Commit: `feat: add login endpoint`

### Task 3.4 — Backend: Refresh token endpoint
- Написать тест: `POST /auth/refresh` с refreshToken → новая пара токенов, старый revoke
- Реализовать endpoint:
  - Проверить refresh token в БД
  - Удалить старый, создать новый
  - Вернуть новую пару
- Тест проходит
- Commit: `feat: add refresh token endpoint`

### Task 3.5 — Backend: Auth middleware
- Написать тест: защищённый endpoint без токена → 401, с невалидным → 401
- Реализовать JWT middleware (@fastify/jwt)
- Добавить декоратор `request.user` с данными из JWT
- Тест проходит
- Commit: `feat: add jwt auth middleware`

### Task 3.6 — Backend: Logout endpoint
- Написать тест: `POST /auth/logout` → удаляет refresh token
- Реализовать endpoint (revoke refresh token)
- Тест проходит
- Commit: `feat: add logout endpoint`

### Task 3.7 — Frontend: Auth pages with Zod validation
- Создать `app/auth/register/page.tsx` — форма с react-hook-form + Zod
- Создать `app/auth/login/page.tsx` — форма логина
- Создать `lib/api.ts` — axios instance с interceptors
- Создать `store/auth.ts` (Zustand) — состояние пользователя, persist
- Настроить автоматический refresh token при 401
- Проверить вручную: регистрация → логин → редирект на главную
- Commit: `feat: add auth pages and store`

---

## Phase 4: Event System & Outbox Pattern

### Task 4.1 — Prisma schema: Event system
```prisma
model Outbox {
  id          String   @id @default(cuid())
  aggregate   String   // "task", "wallet", etc.
  aggregateId String
  type        String   // "TaskCreated", "TaskApproved", etc.
  payload     Json
  status      OutboxStatus @default(PENDING)
  retryCount  Int      @default(0)
  error       String?
  processedAt DateTime?
  createdAt   DateTime @default(now())
}

enum OutboxStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model DomainEvent {
  id          String   @id @default(cuid())
  type        String
  aggregate   String
  aggregateId String
  payload     Json
  createdAt   DateTime @default(now())
}
```
- Мигрировать
- Создать индекс `idx_outbox_pending` на `(status, created_at)`
- Commit: `feat: add outbox and domain event models`

### Task 4.2 — Backend: Event Bus (Redis Streams)
- Создать `src/lib/event-bus.ts`
- Реализовать publish/subscribe через Redis Streams
- Создать типизированные event definitions
- Написать тест: publish → subscribe получает событие
- Commit: `feat: add event bus with redis streams`

### Task 4.3 — Backend: Outbox Worker
- Создать `src/workers/outbox.ts`
- Worker каждые 5 секунд:
  1. Выбирает PENDING outbox записи (LIMIT 10, ORDER BY createdAt)
  2. Устанавливает status PROCESSING
  3. Публикует событие в Event Bus
  4. При успехе: status COMPLETED, создаёт DomainEvent
  5. При ошибке: retryCount++, если >3 → status FAILED, логировать
- Написать тест: outbox запись обрабатывается и публикует событие
- Commit: `feat: add outbox worker`

### Task 4.4 — Backend: Event Handlers Registry
- Создать `src/handlers/registry.ts` — регистрация обработчиков
- Создать базовый класс `EventHandler`
- Реализовать механизм подписки на события
- Commit: `feat: add event handlers registry`

---

## Phase 5: Agents & Services

### Task 5.1 — Prisma schema: Agent + Service with security
```prisma
model Agent {
  id            String    @id @default(cuid())
  ownerId       String
  owner         User      @relation(fields: [ownerId], references: [id])
  name          String
  description   String
  skills        String[]
  hourlyRate    Int
  apiKey        String    @unique @default(cuid())
  apiKeyRotatedAt DateTime @default(now())
  ipWhitelist   String[]  @default([])
  isOnline      Boolean   @default(false)
  lastPollAt    DateTime?
  rating        Float     @default(0)
  totalTasks    Int       @default(0)
  successRate   Float     @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  
  services      Service[]
  tasks         Task[]
  reviews       Review[]
  badges        Badge[]
}

model Service {
  id          String  @id @default(cuid())
  agentId     String
  agent       Agent   @relation(fields: [agentId], references: [id])
  title       String
  description String
  price       Int
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
}
```
- Мигрировать
- Создать индексы: `idx_agents_rating`, `idx_agents_online`
- Commit: `feat: add agent and service models`

### Task 5.2 — Backend: CRUD агентов
- Написать тесты: create/get/update/delete агента
- Реализовать endpoints:
  - `POST /agents` — создать агента (генерировать apiKey)
  - `GET /agents` — список всех (маркет) с пагинацией, фильтрами
  - `GET /agents/:id` — профиль агента
  - `PUT /agents/:id` — обновить (только владелец)
  - `DELETE /agents/:id` — soft delete (только владелец)
- Тесты проходят
- Commit: `feat: add agent CRUD endpoints`

### Task 5.3 — Backend: CRUD услуг агента
- Написать тесты: create/get/update/delete услуги
- Реализовать endpoints:
  - `POST /agents/:id/services` — добавить услугу
  - `GET /agents/:id/services` — список услуг
  - `PUT /agents/:agentId/services/:serviceId` — обновить
  - `DELETE /agents/:agentId/services/:serviceId` — soft delete
- Тесты проходят
- Commit: `feat: add service CRUD endpoints`

### Task 5.4 — Backend: API Key Security
- Создать `POST /agents/:id/rotate-key` — ротация API ключа
- Создать `PUT /agents/:id/ip-whitelist` — обновление IP whitelist
- Добавить middleware для аутентификации агентов по API key
- Добавить rate limiting для агентских endpoint'ов (100 req/min)
- Добавить аудит логирование всех запросов с API ключом
- Написать тесты
- Commit: `feat: add api key rotation and ip whitelist`

### Task 5.5 — Frontend: Маркет агентов
- Создать `app/(main)/page.tsx` — маркет: сетка карточек агентов
- Создать `components/agent/AgentCard.tsx` — карточка с online-индикатором
- Создать `components/agent/AgentFilters.tsx` — фильтры по навыкам, цене, рейтингу, online
- Подключить через SWR: `GET /agents`
- Добавить debounce для поиска
- Commit: `feat: add agent marketplace page`

### Task 5.6 — Frontend: Профиль агента
- Создать `app/(main)/agents/[id]/page.tsx`
- Секции: описание, навыки, услуги, рейтинг, отзывы, бейджи
- Кнопка "Нанять" / "Заказать услугу"
- Commit: `feat: add agent profile page`

### Task 5.7 — Frontend: Управление агентами
- Создать `app/(main)/my-agents/page.tsx` — список моих агентов
- Создать `app/(main)/my-agents/new/page.tsx` — форма создания
- Создать `app/(main)/my-agents/[id]/page.tsx` — управление: API-ключ (показать/скопировать), кнопка ротации, IP whitelist, услуги, статистика
- Commit: `feat: add agent management pages`

---

## Phase 6: SSE Real-time System

### Task 6.1 — Backend: SSE Infrastructure
- Установить: `@fastify/sse-v2` или использовать raw Node.js streams
- Создать `src/lib/sse.ts` — менеджер SSE соединений на Redis Pub/Sub
- Реализовать: subscribe на канал пользователя, broadcast сообщений
- Написать тест: клиент подключается к SSE, получает сообщение
- Commit: `feat: add sse infrastructure`

### Task 6.2 — Backend: SSE Endpoint for Customers
- Создать `GET /events/stream` — SSE endpoint для заказчиков (JWT auth)
- Подключение: клиент получает userId из JWT, подписывается на канал `user:{userId}`
- Отправка: при событиях (task update, progress) → publish в Redis → broadcast всем подключениям
- Написать тест: создание задания → заказчик получает SSE событие
- Commit: `feat: add customer sse endpoint`

### Task 6.3 — Backend: SSE Endpoint for Agents
- Создать `GET /api/v1/agent/events/stream` — SSE endpoint для агентов (API key auth)
- Агент подключается с `X-Agent-API-Key`, подписывается на канал `agent:{agentId}`
- Обновлять `agent.isOnline = true`, `lastPollAt = now()`
- При отключении: отложенная установка `isOnline = false` (через 2 мин)
- Написать тест: агент подключается, получает assigned task
- Commit: `feat: add agent sse endpoint`

### Task 6.4 — Backend: Online Status Detection
- Создать cron job (каждые 2 мин): `agent.lastPollAt < now - 5 min` → `isOnline = false`
- Добавить метрику `agent_online_total`
- Commit: `feat: add agent offline detection`

### Task 6.5 — Frontend: SSE Hook
- Создать `hooks/useSSE.ts` — React hook для SSE подключения
- Автоматическое переподключение при разрыве (exponential backoff)
- Интеграция с Zustand для обновления состояния
- Обработка событий: `task.created`, `task.updated`, `progress.new`
- Commit: `feat: add useSSE hook`

---

## Phase 7: Tasks & Escrow with Outbox

### Task 7.1 — Prisma schema: Task + Progress + Indexes
```prisma
model Task {
  id            String     @id @default(cuid())
  customerId    String
  customer      User       @relation("CustomerTasks", fields: [customerId], references: [id])
  agentId       String
  agent         Agent      @relation(fields: [agentId], references: [id])
  serviceId     String?
  title         String
  description   String
  budget        Int
  status        TaskStatus @default(CREATED)
  result        String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  acceptedAt    DateTime?
  completedAt   DateTime?
  autoCloseAt   DateTime?
  deletedAt     DateTime?
  
  progress      Progress[]
  review        Review?
  dispute       Dispute?
}

enum TaskStatus {
  CREATED
  ACCEPTED
  IN_PROGRESS
  REVIEW
  COMPLETED
  DISPUTED
  CANCELLED
}

model Progress {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id])
  message   String
  metadata  Json?    // дополнительные данные
  createdAt DateTime @default(now())
}
```
- Мигрировать
- Создать индексы:
  - `idx_tasks_customer: (customerId, createdAt DESC)`
  - `idx_tasks_agent: (agentId, status)`
  - `idx_tasks_status: (status, createdAt) WHERE status IN ('CREATED', 'ACCEPTED', 'IN_PROGRESS')`
- Commit: `feat: add task and progress models with indexes`

### Task 7.2 — Backend: Create Task + Escrow via Outbox
- Написать тест: создать задание → Пульсы заморожены через Outbox
- Реализовать `POST /tasks`:
  1. Проверить баланс заказчика >= budget (в транзакции)
  2. Создать Task со статусом CREATED
  3. Создать Outbox запись: `type: "EscrowLock"`, payload: {userId, amount, taskId}
  4. Вернуть task с idempotency key
- Тест проходит
- Commit: `feat: add create task with outbox escrow`

### Task 7.3 — Backend: Escrow Handler
- Создать `src/handlers/escrow.ts`
- Обработчик `EscrowLock`:
  1. Найти пользователя
  2. `balance -= amount`, `frozen += amount`
  3. Создать Transaction запись (type: ESCROW_LOCK)
  4. Отправить SSE уведомление заказчику
- Обработчик `EscrowRelease` (при отмене)
- Обработчик `Payment` (при подтверждении)
- Написать тесты
- Commit: `feat: add escrow event handlers`

### Task 7.4 — Backend: Agent Accept/Decline Task
- Написать тест: агент принимает → статус ACCEPTED, SSE заказчику
- Реализовать `POST /api/v1/agent/tasks/:id/accept` (auth по apiKey)
- Реализовать `POST /api/v1/agent/tasks/:id/decline`:
  - Статус CANCELLED
  - Outbox: `EscrowRelease` (возврат средств)
  - SSE заказчику
- Тесты проходят
- Commit: `feat: add task accept/decline endpoints`

### Task 7.5 — Backend: Progress Log with SSE
- Написать тест: агент пишет прогресс → сохраняется, SSE заказчику
- Реализовать `POST /api/v1/agent/tasks/:id/progress`
- Публиковать событие `ProgressCreated` → broadcast через SSE
- Тест проходит
- Commit: `feat: add task progress with sse`

### Task 7.6 — Backend: Complete Task
- Написать тест: агент сдаёт результат → статус REVIEW, SSE
- Реализовать `POST /api/v1/agent/tasks/:id/complete`
- Установить `autoCloseAt = now + 7 days`
- Тест проходит
- Commit: `feat: add task complete endpoint`

### Task 7.7 — Backend: Approve Task + Payment via Outbox
- Написать тест: подтверждение → Outbox запись Payment
- Реализовать `POST /tasks/:id/approve`:
  1. Проверить статус REVIEW
  2. Создать Outbox: `type: "Payment"`, payload: {taskId, agentId, customerId, amount}
  3. Статус → COMPLETED
- Тест проходит
- Commit: `feat: add task approve with outbox payment`

### Task 7.8 — Backend: Payment Handler
- Обработчик `Payment`:
  1. Заказчик: `frozen -= amount`
  2. Агент: `balance += amount * 0.9` (90% — MVP: 100%)
  3. Платформа: `balance += amount * 0.1` (10% комиссия — MVP: 0%)
  4. Создать Transaction записи (PAYMENT, EARNING, COMMISSION)
  5. Обновить статистику агента
  6. Опубликовать `TaskPaid` событие
  7. SSE заказчику и агенту
- Написать тест
- Commit: `feat: add payment handler`

### Task 7.9 — Backend: Auto-close after 7 days
- Написать тест: задание в REVIEW > 7 дней → авто-approve
- Реализовать cron job (каждый час):
  - Найти задания где `autoCloseAt < now AND status = REVIEW`
  - Для каждого вызвать approve logic
- Добавить метрику `tasks_auto_closed_total`
- Тест проходит
- Commit: `feat: add auto-close cron job`

### Task 7.10 — Frontend: Create Task
- Создать `app/(main)/tasks/new/page.tsx` — форма
- Поля: название, описание, бюджет, дедлайн, выбор агента/услуги
- Генерация idempotency key на клиенте
- После создания — редирект на страницу задания
- Commit: `feat: add create task page`

### Task 7.11 — Frontend: Task List
- Создать `app/(main)/tasks/page.tsx` — список заданий
- Фильтры по статусу, real-time обновления через SSE
- Commit: `feat: add my tasks page`

### Task 7.12 — Frontend: Task Detail with Real-time
- Создать `app/(main)/tasks/[id]/page.tsx`
- Секции: детали, статус, лог прогресса (real-time SSE), результат
- Кнопки: "Подтвердить результат" / "Открыть спор"
- Подписка на SSE для получения обновлений прогресса
- Commit: `feat: add task detail page with sse`

---

## Phase 8: Wallet & Transactions

### Task 8.1 — Prisma schema: Transaction with types
```prisma
model Transaction {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  type        TransactionType
  amount      Int
  balanceAfter Int            // баланс после операции
  taskId      String?
  metadata    Json?           // дополнительные данные
  comment     String?
  createdAt   DateTime        @default(now())
}

enum TransactionType {
  DEPOSIT
  WITHDRAW
  ESCROW_LOCK
  ESCROW_RELEASE
  PAYMENT
  EARNING
  COMMISSION
  BONUS
}
```
- Мигрировать
- Создать индекс `idx_transactions_user: (userId, createdAt DESC)`
- Commit: `feat: add transaction model`

### Task 8.2 — Backend: Transaction History
- Написать тест: `GET /wallet/transactions` → список с пагинацией
- Реализовать endpoint с cursor-based пагинацией
- Фильтры по type, date range
- Тест проходит
- Commit: `feat: add transaction history endpoint`

### Task 8.3 — Backend: Wallet Stats
- Реализовать `GET /wallet/stats` — активный/замороженный баланс, статистика
- Написать тест
- Commit: `feat: add wallet stats endpoint`

### Task 8.4 — Frontend: Wallet Page
- Создать `app/(main)/wallet/page.tsx`
- Секции: баланс активный/замороженный, история транзакций (таблица), кнопка пополнения
- Real-time обновление баланса через SSE
- Commit: `feat: add wallet page`

---

## Phase 9: Reputation System

### Task 9.1 — Prisma schema: Review + Badge
```prisma
model Review {
  id        String   @id @default(cuid())
  taskId    String   @unique
  task      Task     @relation(fields: [taskId], references: [id])
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  customerId String
  rating    Int      // 1-5
  comment   String?
  createdAt DateTime @default(now())
}

model Badge {
  id        String   @id @default(cuid())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  type      String   // "10_tasks", "50_tasks", "100_tasks", "top_week", "fast_executor"
  earnedAt  DateTime @default(now())
}
```
- Мигрировать
- Commit: `feat: add review and badge models`

### Task 9.2 — Backend: Create Review
- Написать тест: заказчик оставляет отзыв → рейтинг агента обновляется
- Реализовать `POST /tasks/:id/review` (только после COMPLETED)
- Публиковать `ReviewCreated` событие
- Тест проходит
- Commit: `feat: add create review endpoint`

### Task 9.3 — Backend: Reputation Handler
- Создать `src/handlers/reputation.ts`
- Обработчик `ReviewCreated`:
  - Пересчитать `agent.rating` (среднее всех отзывов)
  - Пересчитать `agent.successRate` (успешные / всего)
- Обработчик `TaskPaid`:
  - Увеличить `agent.totalTasks`
  - Проверить бейджи (10, 50, 100 задач)
- Обработчик `BadgeCheck` (cron каждый понедельник):
  - Топ агенты недели → бейдж "top_week"
- Написать тесты
- Commit: `feat: add reputation event handlers`

### Task 9.4 — Frontend: Reviews
- Добавить секцию отзывов на страницу агента
- Добавить форму создания отзыва после завершения задачи
- Отображение бейджей
- Commit: `feat: add reviews ui`

---

## Phase 10: Dispute & Arbitration

### Task 10.1 — Prisma schema: Dispute
```prisma
model Dispute {
  id          String        @id @default(cuid())
  taskId      String        @unique
  task        Task          @relation(fields: [taskId], references: [id])
  openedBy    String        // userId
  reason      String
  status      DisputeStatus @default(OPEN)
  resolution  DisputeResolution?
  resolvedBy  String?
  resolutionNote String?
  createdAt   DateTime      @default(now())
  resolvedAt  DateTime?
}

enum DisputeStatus {
  OPEN
  IN_REVIEW
  RESOLVED
}

enum DisputeResolution {
  CUSTOMER_WINS
  AGENT_WINS
  SPLIT
}
```
- Мигрировать
- Commit: `feat: add dispute model`

### Task 10.2 — Backend: Open Dispute
- Написать тест: заказчик открывает спор → статус DISPUTED, Outbox запись
- Реализовать `POST /tasks/:id/dispute`
- Создать Dispute, обновить Task.status
- Оповещение администраторов (SSE или лог)
- Тест проходит
- Commit: `feat: add open dispute endpoint`

### Task 10.3 — Backend: Resolve Dispute (Admin)
- Написать тест: админ разрешает спор → Пульсы уходят нужной стороне через Outbox
- Реализовать `POST /admin/disputes/:id/resolve` (только admin роль)
- Резолюции: CUSTOMER_WINS, AGENT_WINS, SPLIT
- Создать Outbox записи для перевода средств
- Тест проходит
- Commit: `feat: add dispute resolution endpoint`

### Task 10.4 — Frontend: Disputes
- Создать `app/(main)/disputes/page.tsx` — мои споры
- Создать `app/(main)/disputes/[id]/page.tsx` — страница спора
- Кнопка "Открыть спор" на странице задания
- Commit: `feat: add dispute pages`

---

## Phase 11: Deployment & DevOps

### Task 11.1 — Docker Configuration
- Создать `backend/Dockerfile` (multi-stage, Node 20 alpine)
- Создать `frontend/Dockerfile` (multi-stage, static export)
- Создать `docker-compose.yml`:
  - app (backend)
  - web (frontend)
  - postgres (15)
  - redis (7)
  - nginx
- Настроить healthchecks для всех сервисов
- Проверить: `docker-compose up` поднимает всё
- Commit: `feat: add docker configuration`

### Task 11.2 — Environment Configuration
- Создать `.env.example` с документацией всех переменных:
  - `DATABASE_URL`, `REDIS_URL`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `SENTRY_DSN`
  - `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`
  - `TON_CONNECT_KEY`
- Создать `backend/src/config/index.ts` — валидация env через Zod
- Commit: `docs: add env configuration`

### Task 11.3 — Nginx Configuration
- Создать `nginx/nginx.conf`:
  - `/` → frontend (static)
  - `/api` → backend
  - `/events` → backend (SSE with special timeout settings)
  - `/metrics` → ограничить по IP
- Настроить gzip, rate limiting на уровне nginx
- SSL через Let's Encrypt (certbot)
- Commit: `feat: add nginx configuration`

### Task 11.4 — Database Migrations & Seeding
- Создать `backend/prisma/seed.ts` — начальные данные (admin пользователь)
- Создать скрипт `migrate-and-start.sh`
- Настроить в docker-compose
- Commit: `feat: add db seeding`

### Task 11.5 — GitHub Actions CI/CD
- Создать `.github/workflows/ci.yml`:
  - Lint, type check, test для backend
  - Lint, build для frontend
- Создать `.github/workflows/deploy.yml`:
  - Build Docker images
  - Push to registry (GitHub Packages / Docker Hub)
  - Deploy на DigitalOcean через SSH
- Добавить通知 в Telegram/Slack при deploy
- Commit: `feat: add github actions workflows`

### Task 11.6 — Monitoring Setup
- Создать `docker-compose.monitoring.yml`:
  - Prometheus (сбор метрик)
  - Grafana (визуализация)
  - Node Exporter (метрики хоста)
  - Redis Exporter
  - Postgres Exporter
- Создать Grafana dashboards:
  - System metrics
  - Application metrics (RPS, latency, errors)
  - Business metrics (задания, транзакции)
- Настроить alerts (Alertmanager) на критические ошибки
- Commit: `feat: add monitoring stack`

### Task 11.7 — Backup Strategy
- Создать скрипт `scripts/backup-db.sh` — pg_dump в S3
- Настроить cron для ежедневных бэкапов
- Скрипт `scripts/restore-db.sh` для восстановления
- Документировать процедуру
- Commit: `feat: add backup scripts`

---

## Phase 12: Documentation

### Task 12.1 — API Documentation
- Убедиться что Swagger UI доступен по `/documentation`
- Добавить описания для всех endpoint'ов
- Добавить примеры запросов/ответов
- Commit: `docs: add api documentation`

### Task 12.2 — Agent API Documentation
- Создать `docs/agent-api.md` — подробное руководство для разработчиков агентов
- Примеры кода на Python, Node.js, Go
- Описание SSE протокола
- Обработка ошибок и retry логика
- Commit: `docs: add agent api guide`

### Task 12.3 — Architecture Decision Records (ADR)
- Создать `docs/adr/` — записи о ключевых решениях:
  - 001-why-outbox-pattern.md
  - 002-why-sse-not-websockets.md
  - 003-why-event-driven.md
  - 004-database-indexing-strategy.md
- Commit: `docs: add architecture decision records`

---

## Success Metrics

MVP считается готовым когда:
- [ ] Человек может зарегистрироваться и получить 1000 Пульсов
- [ ] Агент может зарегистрироваться, создать профиль и услуги
- [ ] Заказчик может найти агента на маркете и создать задание (с idempotency)
- [ ] Пульсы замораживаются через Outbox при создании задания
- [ ] Агент получает задание мгновенно через SSE
- [ ] Агент пишет лог прогресса — заказчик видит в real-time
- [ ] Заказчик подтверждает → Пульсы агенту через Outbox
- [ ] Работает авто-закрытие через 7 дней
- [ ] Работает система отзывов и рейтинга (event-driven)
- [ ] Можно открыть и разрешить спор
- [ ] Все mutation endpoint'ы поддерживают idempotency keys
- [ ] Есть rate limiting и аудит API ключей
- [ ] Работает мониторинг (Prometheus + Grafana)
- [ ] Деплой на продакшн работает (Docker + CI/CD)
- [ ] API документировано (OpenAPI + Swagger)

---

## Estimated Effort

| Phase | Задачи | Примерное время |
|-------|--------|----------------|
| 1. Setup & Foundation | 7 | 4 часа |
| 2. Observability | 5 | 3 часа |
| 3. Auth | 7 | 4 часа |
| 4. Event System | 4 | 3 часа |
| 5. Agents | 7 | 5 часов |
| 6. SSE Real-time | 5 | 4 часа |
| 7. Tasks & Escrow | 12 | 8 часов |
| 8. Wallet | 4 | 2 часа |
| 9. Reputation | 4 | 2 часа |
| 10. Disputes | 4 | 2 часа |
| 11. Deployment | 7 | 5 часов |
| 12. Documentation | 3 | 2 часа |
| **Итого** | **69** | **~44 часа** |

---

## Risk Mitigation

| Риск | Митигация |
|------|-----------|
| Outbox worker падает | Мониторинг очереди, алерт при >100 pending |
| SSE соединения текут | Connection limits, heartbeat каждые 30 сек |
| Rate limiting ломает легитимный трафик | Configurable limits, whitelist для внутренних |
| Потеря данных при деплое | Бэкапы перед деплоем, миграции обратно совместимы |
| Комиссия 0% не окупается | MVP цель — traction, не profit; метрики для V2 |
