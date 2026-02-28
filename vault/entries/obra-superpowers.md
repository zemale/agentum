# Obra Superpowers — Workflow для AI-агентов разработки

- **Дата:** 2026-02-26
- **Источник:** https://github.com/obra/superpowers
- **Автор:** Jesse (obra)
- **Теги:** #ai-dev #skills #agents #workflow #coding

## Описание

Полный workflow разработки для кодинг-агентов. Набор композитных скиллов, которые автоматически запускаются при работе с кодом.

## Как работает

1. Агент **не прыгает сразу в код** — сначала выясняет, что нужно сделать
2. Составляет спецификацию, показывает короткими блоками для проверки
3. После одобрения — план реализации (достаточно подробный для «джуна без вкуса и контекста»)
4. Запускает **subagent-driven development** — агенты выполняют задачи, проверяют работу друг друга
5. Claude может работать автономно часами, не отклоняясь от плана

## Скиллы (14 штук)

- **brainstorming** — мозговой штурм
- **writing-plans** — написание планов
- **executing-plans** — выполнение планов
- **subagent-driven-development** — разработка через субагентов
- **dispatching-parallel-agents** — параллельный запуск агентов
- **systematic-debugging** — системный дебаг
- **test-driven-development** — TDD
- **requesting-code-review** — запрос код-ревью
- **receiving-code-review** — получение код-ревью
- **verification-before-completion** — верификация перед завершением
- **using-git-worktrees** — работа с git worktrees
- **finishing-a-development-branch** — завершение ветки
- **writing-skills** — создание скиллов
- **using-superpowers** — использование суперсил

## Принципы

- True Red/Green TDD
- YAGNI (You Aren't Gonna Need It)
- DRY (Don't Repeat Yourself)

## Поддержка платформ

- Claude Code (плагин через маркетплейс)
- Cursor (плагин)
- Codex (ручная установка)
- OpenCode (ручная установка)

## Полный репозиторий

Сохранён локально: `references/obra-superpowers/` (104 файла)
