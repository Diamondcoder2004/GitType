# GitType — QWEN Context

## Project Overview

**GitType** — тренажёр слепой печати на реальном коде из GitHub-репозиториев. Проект состоит из двух частей:

1. **Web-приложение** (`/web`) — основное приложение с интерфейсом в стиле Monkeytype
2. **CLI-версия** (корень проекта) — терминальная версия (папка `GitType/` пуста, вероятно в разработке)

### Технологии

- **Frontend:** React 18 + TypeScript
- **Сборщик:** Vite 5
- **State Management:** Zustand
- **GitHub API:** @octokit/rest
- **Тестирование:** Vitest + Testing Library
- **Стилизация:** CSS modules (без CSS-фреймворка)

### Архитектура web-приложения

```
web/src/
├── components/     # UI-компоненты (Settings, ui/)
├── core/           # Бизнес-логика
│   ├── ast/        # Извлечение блоков кода (languageAdapter)
│   ├── github/     # GitHub клиент (githubClient)
│   ├── repository/ # Построение дерева файлов (treeBuilder)
│   └── typing/     # Движок печати (typingEngine, statsEngine, diffEngine)
├── features/       # Фичи (feature-sliced design)
│   ├── file-tree/  # Дерево файлов репозитория
│   ├── repo-selection/ # Выбор репозитория
│   └── trainer/    # Тренажёр печати
├── store/          # Zustand store (appStore.ts)
└── tests/          # Unit-тесты
```

## Building and Running

### Web-приложение (основная рабочая версия)

```bash
cd web
npm install
npm run dev        # Запуск dev-сервера на http://localhost:3000
npm run build      # Сборка (tsc + vite build)
npm run preview    # Предпросмотр продакшн-сборки
npm test           # Запуск тестов (vitest)
```

### Корневой проект

```bash
npm install
npm run dev        # Запуск web-версии (прокси в web/)
npm run build      # Сборка web-версии
npm run preview    # Предпросмотр
```

### Переменные окружения

- `VITE_GITHUB_TOKEN` — GitHub Personal Access Token (опционально, можно ввести в UI)

## Key Features

- Подключение к GitHub через Personal Access Token
- Загрузка дерева файлов любого публичного репозитория
- Фильтрация файлов по языку программирования (18 языков)
- Извлечение блоков кода из файлов (AST-based)
- Статистика в реальном времени: CPM, WPM, точность, время
- Подсветка символов: зелёный (верно), красный (ошибка), курсор
- Сохранение токена в localStorage
- Тёмная тема в стиле Monkeytype (#323437, акценты #e2b714)

## Development Conventions

- **TypeScript strict mode** включён
- **Feature-sliced design** — логика разделена на `core/` (бизнес-логика), `features/` (фичи), `store/` (состояние)
- **Pure functions** для движка печати и расчёта статистики
- **Zustand** с `useShallow` для оптимизации ререндеров
- **Path aliases:** `@/`, `@core/`, `@features/`, `@store/`, `@components/`
- Тесты находятся в `web/src/tests/` и используют Vitest с jsdom

## State Management

Единый Zustand store (`appStore.ts`) содержит:
- **RepoState:** токен, выбранный репозиторий, дерево файлов, содержимое файла, блоки кода, фильтр языков
- **TrainerState:** режим, ввод пользователя, время, статистика, состояние завершения
- **Actions:** сеттеры для всех полей + `resetTrainer()`

## Core Modules

| Модуль | Назначение |
|--------|-----------|
| `core/github/githubClient.ts` | Работа с GitHub API через @octokit/rest |
| `core/repository/treeBuilder.ts` | Построение и фильтрация дерева файлов |
| `core/ast/blockExtractor.ts` | Извлечение блоков кода из файлов |
| `core/typing/typingEngine.ts` | Обработка ввода, статусы символов |
| `core/typing/statsEngine.ts` | Расчёт CPM, WPM, точности |
| `core/typing/diffEngine.ts` | Сравнение текста |
