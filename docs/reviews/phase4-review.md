# Phase 4 Code Review — Agentum MVP

**Reviewer:** Senior Code Review (automated)  
**Date:** 2026-02-28  
**Phase:** 4 (Tasks 4.1–4.10) — Task lifecycle, escrow, auto-close, frontend  
**Overall Score: 6.5 / 10**

---

## Summary

Phase 4 implements the core task lifecycle: creation with escrow, accept, progress, complete, approve, and auto-close cron. The code is clear, readable, and mostly correct. Authentication is applied consistently. The escrow math is functionally correct for the happy path.

However, there are several **critical** issues around financial integrity (race conditions, balance inconsistency after approve), missing validation (status transitions, budget bounds), and incomplete test coverage. The schema uses `String` for status instead of an enum, missing indexes on hot query fields. The frontend is solid UX-wise but has a few gaps.

---

## Critical Issues (Must Fix)

### 1. 🔴 Race Condition in Balance Check (tasks.ts, POST /tasks)
```ts
const customer = await prisma.user.findUnique(...)
if (!customer || customer.balance < budget) { ... }
// ... then later:
prisma.user.update({ data: { balance: { decrement: budget } } })
```
There is a TOCTOU (Time-of-Check-Time-of-Use) race: two simultaneous task creation requests can both pass the balance check and double-spend the same funds.

**Fix:** Use optimistic concurrency — add a `WHERE balance >= budget` condition to the update, or use `SELECT ... FOR UPDATE` via raw SQL, or check the result of decrement and rollback if balance went negative.

```ts
// Option: atomic check+update with a filter
const updated = await prisma.user.updateMany({
  where: { id: payload.id, balance: { gte: budget } },
  data: { balance: { decrement: budget }, frozen: { increment: budget } },
})
if (updated.count === 0) return reply.status(402).send(...)
```

---

### 2. 🔴 Frozen Balance Not Zeroed Correctly After Approve (tasks.ts, approveTask)
```ts
prisma.user.update({
  where: { id: task.customerId },
  data: { frozen: { decrement: task.budget } },
})
```
If `frozen` is somehow already < `task.budget` (due to manual correction, bug, or race), `frozen` goes **negative** — Prisma/SQLite won't reject this since it's an Int without a `@check` constraint.

**Fix:** Add a guard, or use `Math.max(0, frozen - budget)` via a raw update, or add a DB-level constraint. At minimum, assert that `customer.frozen >= task.budget` inside the transaction.

---

### 3. 🔴 No Status Validation on `progress` and `complete` Endpoints
- `POST /tasks/:id/progress` — allows posting progress even if task is in CREATED, COMPLETED, or CANCELLED state. An agent can spam progress on a finished task.
- `POST /tasks/:id/complete` — allows completing a task that was never accepted (status CREATED), or re-completing an already COMPLETED task.

**Fix:**
```ts
// In progress route:
if (!['ACCEPTED', 'IN_PROGRESS'].includes(task.status)) {
  return reply.status(400).send({ error: 'Bad Request', message: 'Task is not in progress' })
}

// In complete route:
if (!['ACCEPTED', 'IN_PROGRESS'].includes(task.status)) {
  return reply.status(400).send({ error: 'Bad Request', message: 'Task cannot be completed in current status' })
}
```

---

### 4. 🔴 approveTask Can Be Called Multiple Times (Double Payment)
There's no idempotency check in `approveTask`. If the cron runs while the customer is also clicking approve, both could call `approveTask` concurrently. The status is updated to COMPLETED inside the transaction — but there's a gap between the read (status check in the route) and the write (inside `approveTask`).

**Fix:** Move the `status !== 'REVIEW'` check inside the `$transaction` using `updateMany` with a `where: { status: 'REVIEW' }` filter and check `count === 1` before crediting the agent:
```ts
const result = await prisma.$transaction([
  prisma.task.updateMany({ where: { id: task.id, status: 'REVIEW' }, data: { status: 'COMPLETED' } }),
  ...
])
if (result[0].count === 0) throw new Error('Already processed')
```

---

### 5. 🔴 No Budget Validation (Negative / Zero / Unreasonably Large)
```ts
const { budget } = request.body
// no server-side check other than balance >= budget
```
A user could create a task with `budget: 0` (or even `budget: -100`) which passes the `customer.balance >= 0` check trivially. The frontend has `min="1"` but server must validate independently.

**Fix:**
```ts
if (typeof budget !== 'number' || budget < 1 || !Number.isInteger(budget)) {
  return reply.status(400).send({ error: 'Bad Request', message: 'Budget must be a positive integer' })
}
```

---

## Important Issues (Should Fix)

### 6. 🟡 Schema: `status` is a Plain String, Not an Enum
```prisma
status  String  @default("CREATED")
```
SQLite doesn't support enums natively, but Prisma does support `enum` type in schema (generates TS union). Using raw strings means a typo like `'COMPELTED'` silently corrupts data.

**Fix:**
```prisma
enum TaskStatus {
  CREATED
  ACCEPTED
  IN_PROGRESS
  REVIEW
  COMPLETED
  DISPUTED
  CANCELLED
}
model Task {
  status  TaskStatus  @default(CREATED)
```
*(For SQLite you can still define enums in Prisma — they're stored as strings in the DB but validated at the Prisma layer.)*

Same issue for `Transaction.type`, `Dispute.status` — all plain strings.

---

### 7. 🟡 Missing Database Indexes on Hot Paths
```prisma
model Task {
  customerId  String   // no @index
  agentId     String   // no @index
  status      String   // no @index — used in cron WHERE
  autoCloseAt DateTime? // no @index — used in cron WHERE
}
model Progress {
  taskId  String  // no @index
}
```
`GET /tasks` does `WHERE customerId = ?` — will full-scan. The cron does `WHERE status='REVIEW' AND autoCloseAt < now()` — also full-scan.

**Fix:** Add `@@index` annotations:
```prisma
@@index([customerId])
@@index([status, autoCloseAt])
```
```prisma
model Progress {
  @@index([taskId])
}
```

---

### 8. 🟡 Transactions Don't Write Transaction Records
`approveTask` and task creation move Пульсы between accounts but never create `Transaction` records. The `Transaction` model exists in the schema but is never used in Phase 4.

**Fix:** Add `prisma.transaction.create(...)` calls inside each `$transaction` block for auditability.

---

### 9. 🟡 Agent Stats Not Updated on Task Completion
`Agent.totalTasks` and `Agent.successRate` are never updated when a task completes/approves.

**Fix:** Add `prisma.agent.update({ where: { id: task.agentId }, data: { totalTasks: { increment: 1 } } })` inside `approveTask` transaction.

---

### 10. 🟡 Missing Message Validation in Progress Endpoint
```ts
const { message } = request.body
// No check for empty string or missing field
await prisma.progress.create({ data: { taskId: id, message } })
```
An agent can post an empty message `""` or omit `message` entirely (will be `undefined`, saved as empty string or crash).

**Fix:**
```ts
if (!message || message.trim().length === 0) {
  return reply.status(400).send({ error: 'Bad Request', message: 'Progress message is required' })
}
```

---

### 11. 🟡 Result Validation Missing in Complete Endpoint
Same as above — `result` could be empty string or omitted.

---

### 12. 🟡 `complete` Route Doesn't Check ACCEPTED Status Before Setting REVIEW
The task could skip straight from CREATED → REVIEW. A status machine check is essential:
```ts
if (task.status !== 'ACCEPTED') { ... }
```
(See Critical #3 — re-stated here at "important" level since it's a workflow integrity issue too.)

---

## Minor Issues (Nice to Fix)

### 13. 🟢 Frontend: `STATUS_LABELS` and `STATUS_COLORS` Duplicated
Both `tasks/page.tsx` and `tasks/[id]/page.tsx` define identical `STATUS_LABELS` and `STATUS_COLORS` maps. Extract to `lib/taskUtils.ts`.

---

### 14. 🟢 Frontend: Task Detail Page — Error State Shows Before Load
```tsx
if (authLoading || !task) {
  return <Skeleton />
}
if (error) { ... }  // never reached if !task shows skeleton
```
The `error` branch is unreachable: if there's an error, `task` is still `undefined` and the skeleton shows instead. Reorder:
```tsx
if (authLoading) return <Skeleton />
if (error) return <ErrorState />
if (!task) return <Skeleton />
```

---

### 15. 🟢 Frontend: Direct `fetch` in SWR Fetcher Instead of `lib/api.ts`
`tasks/[id]/page.tsx` constructs `${API_URL}/tasks/${id}` manually and uses a raw fetch, bypassing the centralized `apiFetch` with error handling. Should use `fetchTask(token, id)` from `lib/api.ts`.

---

### 16. 🟢 `autoCloseAt` Set at Task Creation AND Again at Complete
The `autoCloseAt` field is set to `now + 7 days` when the task is created, then **reset** to `now + 7 days` again when the agent calls `/complete`. This is intentional per spec, but is undocumented. A comment would help.

---

### 17. 🟢 Cron Runs in Same Process as HTTP Server
The hourly cron `setInterval` inside `start()` means a crash in a task route could kill the cron too. For production, this should be a separate worker or use a proper job queue. Fine for MVP, worth noting.

---

### 18. 🟢 Missing `title` and `description` Length Validation
No max-length on text fields — a user could store 1MB strings in SQLite. Add reasonable limits (e.g. title: 200 chars, description: 5000 chars).

---

## Test Coverage Analysis

| Scenario | Covered |
|---|---|
| Create task → escrow deducted | ✅ |
| Create task → 402 on insufficient balance | ✅ |
| Create task → 401 without auth | ✅ |
| Accept task → status ACCEPTED | ✅ |
| Accept task → 403 wrong owner | ✅ |
| Accept task → 400 wrong status (e.g., already ACCEPTED) | ❌ |
| Post progress → record created | ✅ |
| Post progress → empty message | ❌ |
| Post progress → wrong task status | ❌ |
| Complete task → REVIEW status | ✅ |
| Complete task → without accepting first | ❌ |
| Approve task → 90% payment, frozen released | ✅ |
| Approve task → 403 wrong user | ❌ |
| Approve task → 400 wrong status | ❌ |
| Double approve (idempotency) | ❌ |
| Create task with budget=0 | ❌ |
| Create task → agent not found | ❌ |
| GET /tasks → only customer's tasks | ❌ |
| GET /tasks/:id → 403 for stranger | ❌ |
| Auto-close cron logic | ❌ |

**Coverage estimate: ~35%.** Happy paths are covered; negative/edge cases are mostly missing.

---

## Positive Notes

✅ **Clean transaction usage** — escrow creation and approval both use `prisma.$transaction`, which is correct.

✅ **Shared `approveTask` function** — good design to reuse between the HTTP route and the cron job.

✅ **Auth applied consistently** — `preHandler: authenticate` on all task routes, no endpoint left unprotected.

✅ **Access control on task detail** — correctly checks both customer ID and agent owner ID before returning.

✅ **Frontend UX is polished** — status badges, tab filtering, auto-refresh (SWR 10s poll), loading skeletons, confirmation dialog before approve — all solid.

✅ **Auto-close timestamp shown to user** — the detail page shows when the task will auto-close, great UX touch.

✅ **`approveTask` handles flooring correctly** — `Math.floor(budget * 0.9)` prevents fractional Пульсы.

✅ **Test cleanup is thorough** — `cleanupTestData` handles all related records in correct FK order.

---

## Priority Fix Order

1. Fix race condition in balance check (Critical #1)
2. Fix double-approve vulnerability (Critical #4)
3. Add status transition validation to progress/complete (Critical #3)
4. Add budget validation (Critical #5)
5. Guard against negative frozen balance (Critical #2)
6. Add DB indexes (Important #7)
7. Create Transaction records on money movement (Important #8)
8. Add missing test cases for negative paths (Tests coverage)
9. Extract shared frontend constants (Minor #13)
10. Fix unreachable error state in task detail (Minor #14)
