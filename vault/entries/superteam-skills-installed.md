# Суперкоманда программистов — 12 скиллов установлены

- **Дата:** 2026-02-26
- **Источник:** Гибрид Молянов + Obra Superpowers
- **Теги:** #coding #skills #workflow #programming

## Установленные скиллы

### 🎯 Планирование (3 скилла)
| Скилл | Источник | Описание |
|-------|----------|----------|
| **brainstorming** | Superpowers | Исследование идей, дизайн перед реализацией |
| **user-spec-planning** | Молянов | Адаптивное интервью → user-spec.md |
| **tech-spec-planning** | Молянов | Архитектура, решения, план реализации |

### ⚡ Выполнение (4 скилла)
| Скилл | Источник | Описание |
|-------|----------|----------|
| **task-decomposition** | Молянов | Декомпозиция tech-spec на атомарные задачи |
| **subagent-driven-development** | Superpowers | Свежий субагент на задачу + двухэтапное ревью |
| **feature-execution** | Молянов | Оркестрация команды, управление волнами |
| **systematic-debugging** | Superpowers | Системная отладка багов и ошибок |

### ✅ Контроль качества (3 скилла)
| Скилл | Источник | Описание |
|-------|----------|----------|
| **code-reviewing** | Молянов | Ревью кода по стандартам качества |
| **test-master** | Молянов | Стратегия тестирования, test pyramid |
| **verification-before-completion** | Superpowers | Финальная проверка перед коммитом |

### 🛠️ Инфраструктура (2 скилла)
| Скилл | Источник | Описание |
|-------|----------|----------|
| **deploy-pipeline** | Молянов | CI/CD пайплайны, автодеплой |
| **security-auditor** | Молянов | Анализ безопасности по OWASP Top 10 |

## Workflow суперкоманды

```
brainstorming 
    ↓
user-spec-planning
    ↓  
tech-spec-planning
    ↓
task-decomposition
    ↓
subagent-driven-development
    ├── code-reviewing
    └── test-master
    ↓
verification-before-completion
    ↓
deploy-pipeline
    ↓
security-auditor (финальный аудит)
```

## Принципы работы

### Из Молянова:
- **Spec-driven development** — всё начинается с подробного планирования
- **Множественная валидация** — каждый этап проверяется субагентами
- **Industrial workflow** — жёсткая последовательность для качества

### Из Superpowers:
- **Fresh context** — каждая задача выполняется с чистым контекстом
- **TDD-first** — тесты пишутся до кода
- **Verification gates** — проверки на каждом этапе

## Команды для запуска

- `/brainstorming` — начать с исследования идеи
- `/new-user-spec` → user-spec-planning
- `/new-tech-spec` → tech-spec-planning  
- `/decompose-tech-spec` → task-decomposition
- `/do-feature` → feature-execution
- Остальные скиллы вызываются автоматически в процессе

## Статус: ✅ Готово к использованию

Все 12 скиллов установлены в `/root/.openclaw/workspace/skills/` и помечены как `ready` в OpenClaw.