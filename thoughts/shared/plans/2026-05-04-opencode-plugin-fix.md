# Plan: OpenCode Plugin Fix

**Date:** 2026-05-04  
**Status:** Completed ✅  
**Last updated:** 2026-05-05

## Problem Statement

Plannotator `/plannotator-review` и `/plannotator-annotate` не открывали UI — команда срабатывала только на уровне AI-агента (читал описание из `.md` файла), но сам плагин не загружался.

## Root Cause (real)

После детальной диагностики кода `dist/index.js` плагина `@plannotator/opencode` выяснилось:

### 1. Неправильное имя плагина в конфиге
- `opencode.jsonc` содержал `"@plannotator"` 
- Реальное npm-имя пакета: **`@plannotator/opencode`**
- `@plannotator` — это только npm scope (пространство имён), а не имя пакета
- `require('@plannotator')` не резолвится — в `node_modules/@plannotator/` нет `package.json` или `index.js`, только поддиректория `opencode/`

### 2. Плагин не был в директории загрузки OpenCode
- OpenCode (скомпилированный Rust-бинарник, ~183 MB) грузит плагины из `~/.config/opencode/node_modules/`
- Там уже лежал `@opencode-ai/plugin` (plugin SDK)
- `@plannotator/opencode` был установлен только глобально (`AppData/Roaming/npm/node_modules/`)
- OpenCode с таким бинарником не ходит в глобальный npm-кеш за плагинами

### 3. Доказательства неработоспособности
- `C:\Users\almaz\plannotator-debug.log` **не существовал** — `handleServerReady()` ни разу не вызван
- `C:\Users\almaz\.plannotator\` **не существовала** — плагин не инициализировался
- Все 3 процесса OpenCode сервера отвечали основным SPA, ни один не отдавал plannotator UI

## Solution (what worked)

### Шаг 1: Установка плагина в директорию OpenCode
```powershell
Copy-Item "C:\Users\almaz\AppData\Roaming\npm\node_modules\@plannotator" `
          "C:\Users\almaz\.config\opencode\node_modules\" -Recurse -Force
```
Пакет скопирован в: `~/.config/opencode/node_modules/@plannotator/opencode/`
Со всеми зависимостями (`@opencode-ai/plugin`, `effect`, `zod` и т.д.)

### Шаг 2: Исправление имени в конфиге
`opencode.jsonc`:
```jsonc
"plugin": [
    "micode",
    "opencode-plan-cards-plugin",
    "@plannotator/opencode"   // было "@plannotator"
]
```

### Шаг 3: Перезапуск OpenCode
```powershell
taskkill /F /IM opencode.exe
opencode
```

## Verification
- [x] `/plannotator-review` открывает UI ✅
- [x] Code review успешно завершён ("no changes requested")

## Other Plugins Status

| Plugin | Status | Location |
|--------|--------|----------|
| **micode** | ✅ Встроенный в OpenCode | Компилирован в бинарник |
| **octto** | ✅ Работает | Часть micode (интерактивные сессии) |
| **opencode-plan-cards-plugin** | ✅ Установлен (v0.1.5) | `~/.cache/opencode/packages/` |
| **@plannotator/opencode** | ✅ Исправлен (v0.19.7) | `~/.config/opencode/node_modules/` |

## Additional Fix: micode.jsonc — missing sub-agents

**Problem:** Sub-agents without model config in `micode.jsonc` crashed with `ProviderModelNotFoundError`:
```
providerID: "opencode-go",
modelID: "deepseek-v4-flash",
```
Some sub-agents (like `bootstrapper`, `build`, `explore`, `general`) were available in the system prompt but had **no entry** in `micode.jsonc`. When `task(subagent_type="bootstrapper")` was called, OpenCode couldn't find a model for it.

**Solution:** Added 20 missing sub-agents to `micode.jsonc`:
- **System agents (8):** `bootstrapper`, `build`, `docs`, `explore`, `general`, `plan`, `probe`, `triage` — all on `opencode-go/deepseek-v4-flash` (except `general` on `v4-pro`)
- **Mindmodel agents (11):** `mm-anti-pattern-detector`, `mm-code-clusterer`, `mm-constraint-reviewer`, `mm-constraint-writer`, `mm-convention-extractor`, `mm-dependency-mapper`, `mm-domain-extractor`, `mm-example-extractor`, `mm-orchestrator` (with thinking), `mm-pattern-discoverer`, `mm-stack-detector`

**Remaining issue:** `openai/gpt-5.2-codex` error comes from inside the OpenCode binary (hardcoded in Bun runtime), not from any config file. Not fixable from userland.

## Key Insight

OpenCode — это **скомпилированный бинарник** (Rust + embedded JS runtime). Он:
- Имеет встроенные плагины (`micode`)
- Управляет некоторыми плагинами через внутренний кеш (`~/.cache/opencode/packages/`)
- Для внешних npm-плагинов использует `~/.config/opencode/node_modules/`
- **НЕ использует** глобальный npm-кеш (`AppData/Roaming/npm/node_modules/`)
- Конфигурация субагентов — в `~/.config/opencode/micode.jsonc`
