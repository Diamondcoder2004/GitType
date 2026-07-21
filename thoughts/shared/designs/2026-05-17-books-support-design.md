---
date: 2026-05-17
topic: "Поддержка книг в GitType"
status: validated
---

## Проблема

Добавить возможность печатать текст из книг (PDF, EPUB, TXT, Markdown), **не затрагивая** существующую функциональность работы с GitHub-репозиториями.

## Ограничения

- **Полная изоляция** — модуль книг не должен влиять на репозитории
- Trainer уже универсальный — переиспользовать как есть
- Минимальные изменения в App.tsx
- Свой独立的 state,独立的 парсеры,独立的 UI

## Подход

Создать **параллельный изолированный модуль** `features/books/` с:
- Отдельным Zustand store (`bookStore.ts`)
- Своими парсерами форматов (`core/books/parsers/`)
- Своими UI-компонентами (`BookSelector`, `BookTree`)
- Своим прогрессом в localStorage

## Архитектура

```
App.tsx (view: 'repo-select' | 'book-select' | 'trainer')
    │
    ├─→ features/repo-selection/RepoSelector.tsx (существующий)
    │
    └─→ features/books/ (новый модуль)
         ├── BookSelector.tsx
         ├── BookTree.tsx
         └── core/books/
              ├── bookStore.ts
              └── parsers/
                   ├── txtParser.ts
                   ├── markdownParser.ts (существующий)
                   ├── epubParser.ts
                   └── pdfParser.ts
```

## Компоненты

### 1. bookStore.ts (store)

```typescript
interface BookMetadata {
  id: string
  title: string
  author: string
  format: 'pdf' | 'epub' | 'txt' | 'md'
  path: string
  addedAt: number
}

interface Chapter {
  id: string
  title: string
  level: number // 0 = part, 1 = chapter, 2 = section
  children: Chapter[]
}

interface BookState {
  // Выбранная книга
  selectedBook: BookMetadata | null
  chapters: Chapter[]
  currentChapterId: string | null

  // Прогресс
  completedChapters: string[]
  lastPosition: Record<string, number> // chapterId -> char position

  // Actions
  setSelectedBook: (book: BookMetadata) => void
  setChapters: (chapters: Chapter[]) => void
  setCurrentChapter: (chapterId: string) => void
  markChapterComplete: (chapterId: string) => void
  savePosition: (chapterId: string, position: number) => void
}
```

### 2. Парсеры (core/books/parsers/)

| Парсер | Форматы | Зависимости |
|--------|---------|-------------|
| txtParser.ts | .txt | - |
| markdownParser.ts | .md, .markdown | Существующий MarkdownAdapter |
| epubParser.ts | .epub | jszip |
| pdfParser.ts | .pdf | pdfjs-dist |

**Интерфейс парсера:**
```typescript
interface BookParser {
  parse(file: File): Promise<ParsedBook>
}

interface ParsedBook {
  metadata: BookMetadata
  chapters: Chapter[]
  getText(chapterId: string): string
}
```

### 3. BookSelector.tsx (UI)

- Кнопка "Выбрать файл" → `<input type="file" accept=".pdf,.epub,.txt,.md,.markdown">`
- Список недавно открытых книг (из localStorage)
- Карточка книги: название, автор, формат, прогресс
- Кнопка "Удалить" для каждой книги

### 4. BookTree.tsx (UI)

- Древовидное оглавление книги
- Для каждой главы: название, прогресс (completed/pending)
- Выбор главы → загрузка текста в Trainer
- Поддержка уровней: part → chapter → section

### 5. Интеграция в App.tsx

```typescript
type AppView = 'repo-select' | 'book-select' | 'trainer'

// В рендере:
{view === 'repo-select' && <RepoSelectorLarge />}
{view === 'book-select' && <BookSelector />}
{view === 'trainer' && <Trainer />}
```

**Переключение:**
- В RepoSelector: кнопка "Книги" → `setView('book-select')`
- В BookSelector: кнопка "Репозитории" → `setView('repo-select')`

## Поток данных

```
1. Пользователь на welcome-экране
   │
   ├─→ [Репозитории] → RepoSelector → GitHub API → Trainer
   │
   └─→ [Книги] → BookSelector → File Input → Parser
                                            │
                                            ▼
                                      BookTree → Trainer
                                            │
                                            ▼
                                      Trainer (универсальный)
                                      принимает любой текст
```

## Изоляция от GitHub

| Аспект | Изоляция |
|--------|----------|
| **State** | Отдельный `bookStore.ts`, не связан с `appStore.ts` |
| **Парсеры** | Не используют `githubClient` |
| **UI** | Свои компоненты в `features/books/` |
| **Прогресс** | Ключ: `gittype_book_{bookId}` в localStorage |
| **Типы** | Свои `BookMetadata`, `Chapter` — независимы от `RepoState` |

## Тестирование

1. **Парсеры** — юнит-тесты для каждого формата
2. **BookStore** — тесты actions и selectors
3. **Интеграция** — e2e тест: выбрать книгу → главу → напечатать

## Открытые вопросы

1. **PDF сложность** — PDF.js может быть тяжёлым для браузера. Альтернатива: только EPUB/TXT/MD в v1, PDF как v2.
2. **Большие файлы** — EPUB/PDF могут быть 50+ MB. Нужно ограничение или streaming.
3. **Автор/название** — как извлекать из TXT файлов? Использовать имя файла как title.

## Приоритет реализации

1. **Фаза 1:** txtParser + markdownParser + BookSelector → минимальный working prototype
2. **Фаза 2:** epubParser + BookTree (оглавление)
3. **Фаза 3:** pdfParser (опционально, если PDF.js не слишком сложный)