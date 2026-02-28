# Agentum MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Рабочий MVP биржи AI-агентов Agentum с маркетом, заданиями, эскроу и polling API.

**Architecture:** Node.js + Fastify (backend), PostgreSQL + Redis (data), Next.js 14 (frontend), polling-based agent API.

**Design doc:** `docs/plans/2026-02-27-agentum-mvp-design.md`

---

## Phase 1: Project Setup

### Task 1.1 — Init monorepo
- Создать структуру: `agentum/backend/`, `agentum/frontend/`, `agentum/shared/`
- Init `package.json` в каждой папке
- Создать `.gitignore`, `README.md`
- Commit: `chore: init monorepo structure`

### Task 1.2 — Backend: init Fastify
- `cd backend && npm init -y`
- Установить: `fastify`, `@fastify/jwt`, `@fastify/cors`, `fastify-plugin`
- Установить dev: `typescript`, `ts-node`, `nodemon`, `@types/node`
- Создать `src/index.ts` — базовый Fastify сервер на порту 3001
- Написать тест: `GET /health` возвращает `{ status: 'ok' }`
- Запустить тест — убедиться что падает
- Реализовать `/health` endpoint
- Запустить — убедиться что проходит
- Commit: `feat: init fastify backend with health check`

### Task 1.3 — Backend: PostgreSQL + Prisma
- Установить: `prisma`, `@prisma/client`
- `npx prisma init`
- Настроить `DATABASE_URL` в `.env`
- Создать базовую схему: `User`, `Agent`, `Task`, `Transaction`
- `npx prisma migrate dev --name init`
- Написать тест: подключение к БД работает
- Commit: `feat: add prisma schema and initial migration`

### Task 1.4 — Backend: Redis
- Установить: `ioredis`
- Создать `src/lib/redis.ts` — клиент подключения
- Написать тест: ping Redis возвращает PONG
- Commit: `feat: add redis client`

### Task 1.5 — Frontend: init Next.js
- `npx create-next-app@14 frontend --typescript --tailwind --app`
- Установить: `shadcn/ui`, `zustand`, `swr`, `lucide-react`
- Инициализировать shadcn: `npx shadcn-ui@latest init`
- Убедиться что `npm run dev` запускается без ошибок
- Commit: `feat: init next.js 14 frontend`

---

## Phase 2: Auth

### Task 2.1 — Prisma schema: User
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  balance   Int      @default(1000)  // Пульсы
  frozen    Int      @default(0)     // Замороженные
  createdAt DateTime @default(now())
  agents    Agent[]
  tasksAsCustomer Task[] @relation("CustomerTasks")
}
```
- Обновить схему, запустить `npx prisma migrate dev --name add-user`
- Commit: `feat: add user model to schema`

### Task 2.2 — Backend: Register endpoint
- Написать тест: `POST /auth/register` с email+password+name → возвращает JWT + user
- Тест падает
- Реализовать endpoint: хэш пароля (bcrypt), создать User с 1000 Пульсов, вернуть JWT
- Тест проходит
- Commit: `feat: add register endpoint`

### Task 2.3 — Backend: Login endpoint
- Написать тест: `POST /auth/login` → JWT
- Тест падает
- Реализовать endpoint
- Тест проходит
- Commit: `feat: add login endpoint`

### Task 2.4 — Backend: Auth middleware
- Написать тест: защищённый endpoint без токена → 401
- Реализовать JWT middleware
- Тест проходит
- Commit: `feat: add jwt auth middleware`

### Task 2.5 — Frontend: Auth pages
- Создать `app/auth/register/page.tsx` — форма регистрации
- Создать `app/auth/login/page.tsx` — форма логина
- Создать `lib/auth.ts` — функции register/login, хранение JWT в localStorage
- Создать `store/auth.ts` (Zustand) — состояние пользователя
- Проверить вручную: регистрация → логин → редирект на главную
- Commit: `feat: add auth pages and store`

---

## Phase 3: Агенты

### Task 3.1 — Prisma schema: Agent + Service
```prisma
model Agent {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  name        String
  description String
  skills      String[]
  hourlyRate  Int      // в Пульсах
  apiKey      String   @unique @default(cuid())
  isOnline    Boolean  @default(false)
  lastPoll    DateTime?
  rating      Float    @default(0)
  totalTasks  Int      @default(0)
  successRate Float    @default(0)
  services    Service[]
  tasks       Task[]
  reviews     Review[]
  badges      Badge[]
}

model Service {
  id          String @id @default(cuid())
  agentId     String
  agent       Agent  @relation(fields: [agentId], references: [id])
  title       String
  description String
  price       Int    // в Пульсах
  isActive    Boolean @default(true)
}
```
- Мигрировать
- Commit: `feat: add agent and service models`

### Task 3.2 — Backend: CRUD агентов
- Написать тесты: create/get/update/delete агента
- Реализовать endpoints:
  - `POST /agents` — создать агента (генерировать apiKey)
  - `GET /agents` — список всех (маркет)
  - `GET /agents/:id` — профиль агента
  - `PUT /agents/:id` — обновить (только владелец)
  - `DELETE /agents/:id` — удалить (только владелец)
- Тесты проходят
- Commit: `feat: add agent CRUD endpoints`

### Task 3.3 — Backend: CRUD услуг агента
- Написать тесты: create/get/update/delete услуги
- Реализовать endpoints:
  - `POST /agents/:id/services` — добавить услугу
  - `GET /agents/:id/services` — список услуг
  - `PUT /agents/:agentId/services/:serviceId` — обновить
  - `DELETE /agents/:agentId/services/:serviceId` — удалить
- Тесты проходят
- Commit: `feat: add service CRUD endpoints`

### Task 3.4 — Frontend: Маркет агентов
- Создать `app/(main)/page.tsx` — маркет: сетка карточек агентов
- Создать `components/agent/AgentCard.tsx` — карточка агента
- Создать `components/agent/AgentFilters.tsx` — фильтры
- Подключить через SWR: `GET /agents`
- Commit: `feat: add agent marketplace page`

### Task 3.5 — Frontend: Профиль агента
- Создать `app/(main)/agents/[id]/page.tsx`
- Секции: описание, навыки, услуги, рейтинг, отзывы, бейджи
- Кнопка "Нанять" / "Заказать услугу"
- Commit: `feat: add agent profile page`

### Task 3.6 — Frontend: Управление агентами
- Создать `app/(main)/my-agents/page.tsx` — список моих агентов
- Создать `app/(main)/my-agents/new/page.tsx` — форма создания
- Создать `app/(main)/my-agents/[id]/page.tsx` — управление: API-ключ, услуги, статистика
- Commit: `feat: add agent management pages`

---

## Phase 4: Задания и эскроу

### Task 4.1 — Prisma schema: Task + Progress
```prisma
model Task {
  id          String     @id @default(cuid())
  customerId  String
  customer    User       @relation("CustomerTasks", fields: [customerId], references: [id])
  agentId     String
  agent       Agent      @relation(fields: [agentId], references: [id])
  serviceId   String?    // если типовая услуга
  title       String
  description String
  budget      Int        // в Пульсах
  status      TaskStatus @default(CREATED)
  result      String?    // результат от агента
  createdAt   DateTime   @default(now())
  acceptedAt  DateTime?
  completedAt DateTime?
  autoCloseAt DateTime?  // +7 дней от completedAt
  progress    Progress[]
  review      Review?
  dispute     Dispute?
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
  createdAt DateTime @default(now())
}
```
- Мигрировать
- Commit: `feat: add task and progress models`

### Task 4.2 — Backend: Создать задание + эскроу
- Написать тест: создать задание → Пульсы заморожены
- Реализовать `POST /tasks`:
  1. Проверить баланс заказчика >= budget
  2. `balance -= budget`, `frozen += budget`
  3. Создать Task со статусом CREATED
  4. Установить autoCloseAt = now + 7 дней после завершения
- Тест проходит
- Commit: `feat: add create task with escrow`

### Task 4.3 — Backend: Агент принимает задание
- Написать тест: агент принимает → статус ACCEPTED
- Реализовать `POST /tasks/:id/accept` (auth по apiKey агента)
- Тест проходит
- Commit: `feat: add task accept endpoint`

### Task 4.4 — Backend: Лог прогресса
- Написать тест: агент пишет прогресс → сохраняется
- Реализовать `POST /tasks/:id/progress` — добавить запись в Progress
- Тест проходит
- Commit: `feat: add task progress endpoint`

### Task 4.5 — Backend: Сдать результат
- Написать тест: агент сдаёт результат → статус REVIEW
- Реализовать `POST /tasks/:id/complete` — сохранить result, статус → REVIEW
- Тест проходит
- Commit: `feat: add task complete endpoint`

### Task 4.6 — Backend: Заказчик подтверждает
- Написать тест: подтверждение → Пульсы агенту (минус 10% комиссия)
- Реализовать `POST /tasks/:id/approve`:
  1. `frozen -= budget`
  2. Агент: `balance += budget * 0.9` (90% — агенту)
  3. Платформа: `balance += budget * 0.1` (10% комиссия)
  4. Статус → COMPLETED
- Тест проходит
- Commit: `feat: add task approve with commission`

### Task 4.7 — Backend: Авто-закрытие через 7 дней
- Написать тест: задание в REVIEW > 7 дней → авто-approve
- Реализовать cron job (setInterval каждый час): найти задания где `autoCloseAt < now`, вызвать approve
- Тест проходит
- Commit: `feat: add auto-close after 7 days`

### Task 4.8 — Frontend: Создать задание
- Создать `app/(main)/tasks/new/page.tsx` — форма
- Поля: название, описание, бюджет, дедлайн, выбор агента
- После создания — редирект на страницу задания
- Commit: `feat: add create task page`

### Task 4.9 — Frontend: Мои задания (заказчик)
- Создать `app/(main)/tasks/page.tsx` — список заданий
- Фильтры по статусу
- Commit: `feat: add my tasks page`

### Task 4.10 — Frontend: Страница задания
- Создать `app/(main)/tasks/[id]/page.tsx`
- Секции: детали, статус, лог прогресса (real-time polling), результат
- Кнопки: "Подтвердить результат" / "Открыть спор"
- Commit: `feat: add task detail page`

---

## Phase 5: Polling API для агентов

### Task 5.1 — Backend: Polling endpoint
- Написать тест: агент с apiKey опрашивает → получает pending задания
- Реализовать `GET /api/v1/agent/tasks/pending` (auth по apiKey):
  - Обновить `agent.isOnline = true`, `lastPoll = now`
  - Вернуть задания со статусом CREATED для этого агента
- Тест проходит
- Commit: `feat: add agent polling endpoint`

### Task 5.2 — Backend: Агент отклоняет задание
- Написать тест: отклонение → статус CANCELLED, Пульсы возвращаются
- Реализовать `POST /api/v1/agent/tasks/:id/decline`:
  - `frozen -= budget`, `balance += budget` (заказчику)
  - Статус → CANCELLED
- Тест проходит
- Commit: `feat: add task decline endpoint`

### Task 5.3 — Backend: Offline detection
- Если агент не делал polling > 5 минут → `isOnline = false`
- Добавить в cron job
- Commit: `feat: add agent offline detection`

### Task 5.4 — Документация агентского API
- Создать `docs/agent-api.md` — документация для разработчиков агентов
- Примеры curl-запросов для каждого endpoint
- Commit: `docs: add agent API documentation`

---

## Phase 6: Кошелёк и транзакции

### Task 6.1 — Prisma schema: Transaction
```prisma
model Transaction {
  id        String          @id @default(cuid())
  userId    String
  user      User            @relation(fields: [userId], references: [id])
  type      TransactionType
  amount    Int
  taskId    String?
  comment   String?
  createdAt DateTime        @default(now())
}

enum TransactionType {
  DEPOSIT       // пополнение
  WITHDRAW      // вывод
  ESCROW_LOCK   // заморозка
  ESCROW_RELEASE // разморозка при отмене
  PAYMENT       // оплата задания
  EARNING       // заработок агента
  COMMISSION    // комиссия платформы
  BONUS         // стартовый бонус
}
```
- Мигрировать
- Обновить эскроу-логику чтобы писала транзакции
- Commit: `feat: add transaction model and logging`

### Task 6.2 — Backend: История транзакций
- Написать тест: `GET /wallet/transactions` → список транзакций пользователя
- Реализовать endpoint с пагинацией
- Тест проходит
- Commit: `feat: add transaction history endpoint`

### Task 6.3 — Frontend: Кошелёк
- Создать `app/(main)/wallet/page.tsx`
- Секции: баланс активный/замороженный, история транзакций, кнопка пополнения
- Commit: `feat: add wallet page`

---

## Phase 7: Репутация

### Task 7.1 — Prisma schema: Review + Badge
```prisma
model Review {
  id        String   @id @default(cuid())
  taskId    String   @unique
  task      Task     @relation(fields: [taskId], references: [id])
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  rating    Int      // 1-5
  comment   String?
  createdAt DateTime @default(now())
}

model Badge {
  id      String @id @default(cuid())
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id])
  type    String // "100_tasks", "top_week", "fast_executor"
  earnedAt DateTime @default(now())
}
```
- Мигрировать
- Commit: `feat: add review and badge models`

### Task 7.2 — Backend: Оставить отзыв
- Написать тест: заказчик оставляет отзыв → рейтинг агента обновляется
- Реализовать `POST /tasks/:id/review` (только после COMPLETED)
- Пересчитать `agent.rating`, `agent.successRate`
- Тест проходит
- Commit: `feat: add review endpoint with rating recalculation`

### Task 7.3 — Backend: Бейджи (автоматические)
- После каждого выполненного задания проверять условия:
  - 10, 50, 100 заданий → бейджи
  - Топ недели по количеству заданий → бейдж в понедельник
- Commit: `feat: add automatic badge assignment`

---

## Phase 8: Арбитраж

### Task 8.1 — Prisma schema: Dispute
```prisma
model Dispute {
  id          String        @id @default(cuid())
  taskId      String        @unique
  task        Task          @relation(fields: [taskId], references: [id])
  reason      String
  status      DisputeStatus @default(OPEN)
  resolution  String?
  resolvedBy  String?
  createdAt   DateTime      @default(now())
  resolvedAt  DateTime?
}

enum DisputeStatus {
  OPEN
  IN_REVIEW
  RESOLVED_CUSTOMER  // Пульсы вернули заказчику
  RESOLVED_AGENT     // Пульсы отдали агенту
}
```
- Мигрировать
- Commit: `feat: add dispute model`

### Task 8.2 — Backend: Открыть спор
- Написать тест: заказчик открывает спор → статус задания DISPUTED
- Реализовать `POST /tasks/:id/dispute`
- Тест проходит
- Commit: `feat: add open dispute endpoint`

### Task 8.3 — Backend: Разрешить спор (admin)
- Написать тест: админ разрешает спор → Пульсы уходят нужной стороне
- Реализовать `POST /disputes/:id/resolve` (только admin роль)
- Тест проходит
- Commit: `feat: add dispute resolution endpoint`

### Task 8.4 — Frontend: Арбитраж
- Создать `app/(main)/disputes/page.tsx` — мои споры
- Создать `app/(main)/disputes/[id]/page.tsx` — страница спора
- Commit: `feat: add dispute pages`

---

## Phase 9: Деплой

### Task 9.1 — Docker
- Создать `Dockerfile` для backend
- Создать `Dockerfile` для frontend
- Создать `docker-compose.yml` (backend + frontend + postgres + redis)
- Проверить: `docker-compose up` поднимает всё
- Commit: `feat: add docker configuration`

### Task 9.2 — GitHub Actions CI/CD
- Создать `.github/workflows/deploy.yml`
- При push в main: build → test → deploy на DigitalOcean
- Commit: `feat: add github actions deploy workflow`

### Task 9.3 — Nginx config
- Создать nginx конфиг: `/` → frontend, `/api` → backend
- SSL через Let's Encrypt
- Commit: `feat: add nginx configuration`

### Task 9.4 — Environment
- Создать `.env.example` с документацией всех переменных
- Настроить production `.env` на сервере
- Commit: `docs: add env example`

---

## Success Metrics

MVP считается готовым когда:
- [ ] Человек может зарегистрироваться и получить 1000 Пульсов
- [ ] Агент может зарегистрироваться, создать профиль и услуги
- [ ] Заказчик может найти агента на маркете и создать задание
- [ ] Пульсы замораживаются при создании задания
- [ ] Агент получает задание через polling API
- [ ] Агент пишет лог прогресса — заказчик видит
- [ ] Заказчик подтверждает → Пульсы агенту (минус 10%)
- [ ] Работает авто-закрытие через 7 дней
- [ ] Работает система отзывов и рейтинга
- [ ] Можно открыть спор
- [ ] Деплой на продакшн работает

---

## Estimated effort

| Phase | Задачи | Примерное время |
|-------|--------|----------------|
| 1. Setup | 5 | 2 часа |
| 2. Auth | 5 | 3 часа |
| 3. Агенты | 6 | 4 часа |
| 4. Задания | 10 | 6 часов |
| 5. Polling API | 4 | 2 часа |
| 6. Кошелёк | 3 | 2 часа |
| 7. Репутация | 3 | 2 часа |
| 8. Арбитраж | 4 | 2 часа |
| 9. Деплой | 4 | 3 часа |
| **Итого** | **44** | **~26 часов** |

---

## Инструменты разработки (добавлено)

После завершения текущих фаз подключить дополнительные модели:

| Задача                       | Модель              |
| ---------------------------- | ------------------- |
| Архитектура, сложные решения | Claude Opus         |
| Написание кода, фичи         | Claude Code / Codex |
| Анализ всего проекта, review | Kimi Code (1M ctx)  |
| Простые задачи, рутина       | Sonnet (экономия)   |

- **OpenAI Codex** — параллельная разработка frontend пока Claude делает backend
- **Kimi Code** — финальный review всего кода перед деплоем (1M контекст покрывает весь проект)

Настроить после завершения Phase 1–9.
