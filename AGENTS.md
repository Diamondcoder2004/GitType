# GitType Project Analysis

## Overview

**GitType** — тренажёр слепой печати на реальном коде из GitHub-репозиториев.
React + TypeScript SPA без роутинга, два экрана: выбор репозитория и тренажёр.

## Tech Stack

- **Frontend:** React 18, TypeScript 5 (strict)
- **Сборка:** Vite 5 (dev на порту 3000)
- **State:** Zustand 5 (один store)
- **GitHub API:** @octokit/rest
- **Редактор кода:** @monaco-editor/react
- **Тесты:** Vitest + @testing-library/react + jsdom

## Project Structure

```
/
├── web/                    # Web-приложение (основное)
│   ├── src/
│   │   ├── core/           # Бизнес-логика (чистые функции без React)
│   │   │   ├── ast/        # Извлечение блоков кода и анализ
│   │   │   ├── github/     # GitHub API клиент
│   │   │   ├── repository/ # Построение дерева файлов
│   │   │   └── typing/     # Движок печати и статистика
│   │   ├── features/       # Feature-компоненты
│   │   │   ├── trainer/    # Основной тренажёр печати
│   │   │   ├── file-tree/  # Дерево файлов репозитория
│   │   │   └── repo-selection/ # Выбор репозитория
│   │   ├── components/     # UI-компоненты (Settings)
│   │   └── store/          # Zustand store
│   └── dist/               # Production-сборка (не трогать)
├── package.json            # Корневой — прокси в web/
└── AGENTS.md               # Этот файл
```

## Architecture Patterns

- **Feature-Sliced Design** — логика разделена на `core/` (чистая бизнес-логика), `features/` (компоненты фич), `store/` (состояние)
- **Чистые функции** в core/ — typingEngine, statsEngine, treeBuilder, blockExtractor — не зависят от React
- **Adapter Pattern** в core/ast/ — каждый язык программирования через LanguageAdapter интерфейс
- **Единый Zustand Store** — `appStore.ts` с slice-ами: RepoState, TrainerState, Settings, History, UI
- **CSS Variables** для тем — 6 встроенных тем через CSS custom properties

## Key Commands

```bash
npm run dev       # Запуск web (Vite dev server на :3000)
npm run build     # Сборка (tsc + vite build)
npm test          # Тесты (vitest, jsdom)
```

Тесты: `vitest` с globals. Файлы тестов: `web/src/tests/*.test.ts`. Test setup: `@testing-library/jest-dom`.

## Core Components

| Компонент | Файл | Описание |
|---|---|---|
| RepoSelector | `features/repo-selection/RepoSelector.tsx` | Поиск репозиториев через GitHub API |
| FileTree | `features/file-tree/FileTree.tsx` | Дерево файлов с фильтрацией по языку |
| Trainer | `features/trainer/Trainer.tsx` | Основной тренажёр (730 строк) |
| CharSpan | `features/trainer/CharSpan.tsx` | Отрисовка одного символа (memoized) |
| Settings | `components/Settings.tsx` | Полноценные настройки темы/шрифтов |

## Critical Rules

1. **Никогда не менять web/dist/** — это production-сборка, пересобирается через `npm run build`
2. **Всегда отвечать на русском языке** — пользователь русскоязычный
3. **Тесты обязательны** для core-логики (движок печати, адаптеры, статистика)
4. **Feature-first** — новая функциональность = новый модуль в features/
5. **Zustand shallow** — использовать `useShallow` для селекторов, избегать полной подписки на store
6. **Pure functions** — core-модули не должны импортировать React или Zustand
7. **Path aliases**: `@/` → `web/src/`, `@core/`, `@features/`, `@store/`, `@components/`
