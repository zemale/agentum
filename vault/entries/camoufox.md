# Camoufox — Anti-detect Browser

- **Source:** https://github.com/daijro/camoufox
- **Docs:** https://camoufox.com
- **Tags:** #scraping #antibot #browser #fingerprint #automation #python
- **Date:** 2026-02-28

## Что это

Open source антидетект-браузер на базе Firefox. Подделывает браузерные fingerprints без JS-инъекций — невидим для антибот-систем (Cloudflare, DataDome, PerimeterX и др.).

## Ключевые возможности

- Fingerprint injection & rotation (navigator, OS, hardware, screen, viewport)
- Геолокация, таймзона, locale/Intl spoofing
- WebRTC IP spoofing на уровне протокола
- WebGL, Canvas, Font anti-fingerprinting
- Human-like mouse movement
- Встроенный AdBlocker (uBlock Origin)
- Python API (PyPI: `camoufox`)
- GeoIP database включена

## Установка (выполнена)

```bash
pip3 install camoufox[geoip] --break-system-packages
python3 -m camoufox fetch   # скачивает браузер + GeoIP + uBO
```

Версия: camoufox 0.4.11, playwright 1.58.0

## Пример использования

```python
from camoufox.sync_api import Camoufox

with Camoufox(headless=True) as browser:
    page = browser.new_page()
    page.goto("https://example.com")
    print(page.content())
```

## Применение для Agentum

- Парсинг внешних сайтов агентами
- Тестирование frontend без детектирования
- Сбор данных для маркетплейса

## Статус проекта

Основной мейнтейнер передал проект Clover Labs (2026). Активная разработка продолжается. Текущие релизы экспериментальные.
