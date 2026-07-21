# План реализации: Поддержка книг в GitType

**Goal:** Добавить возможность печатать текст из книг (TXT, Markdown, EPUB, PDF опционально) через изолированный модуль `features/books/`, не затрагивая существующую функциональность GitHub-репозиториев.

**Architecture:** Параллельный изолированный модуль с собственным Zustand store (`bookStore.ts`), парсерами форматов (`core/books/parsers/`), своими UI-компонентами (`BookSelector`, `BookTree`) и отдельным прогрессом в localStorage. Trainer переиспользуется как есть — текст главы подаётся через `fileContent` в appStore.

**Design:** `thoughts/shared/designs/2026-05-17-books-support-design.md`

---

## Ключевые архитектурные решения

| Решение | Выбор | Обоснование |
|---------|-------|-------------|
| Как Trainer получает текст книги | Устанавливаем `fileContent` из bookStore в appStore | Trainer уже читает fileContent, изменений не требуется |
| Отслеживание режима "книга" | `useBookStore().selectedBook !== null` | Не нужен отдельный флаг, выводится из состояния |
| Отображение BookTree | В левом сайдбаре вместо FileTree | Соответствует паттерну навигации по репозиторию |
| markdownParser для книг | Новый парсер (не MarkdownAdapter) | AST-адаптер извлекает блоки кода, нам нужен читаемый текст с главами |
| Хранение прогресса | `localStorage` ключ `gittype_book_progress_{bookId}` | Изолирован от репозиториев |
| Размер файла | Лимит 50MB в v1 | Проверка при загрузке |
| EPUB парсер | JSZip + ручной парсинг XHTML | Не тянет тяжёлые зависимости |

---

## Dependency Graph

```
Batch 1 (parallel — foundation, no deps):
  1.1, 1.2, 1.3, 1.4, 1.5

Batch 2 (parallel — store, depends on 1.x):
  2.1, 2.2

Batch 3 (parallel — UI components, depends on 2.x):
  3.1, 3.2, 3.3, 3.4

Batch 4 (serial — integration, depends on 3.x):
  4.1, 4.2, 4.3

Batch 5 (parallel — EPUB Phase 2, depends on 1.x):
  5.1, 5.2
```

---

## TASKS (машинно-читаемый блок)

```yaml
tasks:
  - id: 1.1
    file: web/src/core/books/types.ts
    type: create
    deps: []
    phase: foundation

  - id: 1.2
    file: web/src/core/books/parsers/txtParser.ts
    test: web/src/tests/txtParser.test.ts
    type: create
    deps: [1.1]
    phase: foundation

  - id: 1.3
    file: web/src/core/books/parsers/markdownParser.ts
    test: web/src/tests/markdownParser.test.ts
    type: create
    deps: [1.1]
    phase: foundation

  - id: 1.4
    file: web/src/core/books/progressManager.ts
    test: web/src/tests/progressManager.test.ts
    type: create
    deps: [1.1]
    phase: foundation

  - id: 1.5
    file: web/src/core/books/bookStore.ts
    test: web/src/tests/bookStore.test.ts
    type: create
    deps: [1.1, 1.4]
    phase: foundation

  - id: 2.1
    file: web/src/features/books/BookSelector.tsx
    type: create
    deps: [1.5]
    phase: ui

  - id: 2.2
    file: web/src/features/books/BookSelector.css
    type: create
    deps: [2.1]
    phase: ui

  - id: 2.3
    file: web/src/features/books/BookTree.tsx
    type: create
    deps: [1.5]
    phase: ui

  - id: 2.4
    file: web/src/features/books/BookTree.css
    type: create
    deps: [2.3]
    phase: ui

  - id: 3.1
    file: web/src/store/appStore.ts
    type: modify
    deps: []
    phase: integration
    changes: "Extend AppView type with 'book-select'"

  - id: 3.2
    file: web/src/features/repo-selection/RepoSelector.tsx
    type: modify
    deps: [3.1]
    phase: integration
    changes: "Add 'Books' navigation button, import setView"

  - id: 3.3
    file: web/src/App.tsx
    type: modify
    deps: [2.1, 2.3, 3.1, 3.2]
    phase: integration
    changes: "Integrate BookSelector view, BookTree sidebar, chapter selection → Trainer"

  - id: 4.1
    file: web/src/core/books/parsers/epubParser.ts
    test: web/src/tests/epubParser.test.ts
    type: create
    deps: [1.1]
    phase: epub
    priority: optional

  - id: 4.2
    file: web/package.json
    type: modify
    deps: [4.1]
    phase: epub
    priority: optional
    changes: "Add jszip dependency"
```

---

# Batch 1: Foundation (parallel — 5 implementers)

Все задачи в этом батче независимы друг от друга и выполняются параллельно.

---

## Task 1.1: types.ts — Интерфейсы модуля книг

**File:** `web/src/core/books/types.ts`
**Test:** none (чистые типы)
**Depends:** none

```typescript
/**
 * Модуль книг — типы и интерфейсы
 */

export type BookFormat = 'pdf' | 'epub' | 'txt' | 'md'

export interface BookMetadata {
  id: string
  title: string
  author: string
  format: BookFormat
  /** Оригинальное имя файла */
  path: string
  addedAt: number
  /** Количество глав (для отображения прогресса) */
  totalChapters: number
}

export interface Chapter {
  id: string
  title: string
  /** 0 = part, 1 = chapter, 2 = section */
  level: number
  children: Chapter[]
}

export interface ParsedBook {
  metadata: BookMetadata
  chapters: Chapter[]
  /** Получить текст главы по ID */
  getText(chapterId: string): string
  /** Получить сырой текст всей книги */
  getAllText(): string
}

export interface BookParser {
  parse(file: File): Promise<ParsedBook>
}

/** Структура прогресса для localStorage */
export interface BookProgress {
  completedChapters: string[]
  lastPosition: Record<string, number>
  completedAt?: number
}

/** Лимит размера файла в байтах (50MB) */
export const MAX_BOOK_FILE_SIZE = 50 * 1024 * 1024
```

**Verify:** `npx tsc --noEmit` (компиляция без ошибок)

---

## Task 1.2: txtParser.ts — Парсер TXT файлов

**File:** `web/src/core/books/parsers/txtParser.ts`
**Test:** `web/src/tests/txtParser.test.ts`
**Depends:** 1.1

```typescript
import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

/**
 * Парсер для .txt файлов.
 * Вся книга — одна глава. Название = имя файла без расширения.
 */
export class TxtParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const text = await file.text()
    const name = file.name.replace(/\.[^/.]+$/, '')
    const bookId = crypto.randomUUID()

    const metadata: BookMetadata = {
      id: bookId,
      title: name,
      author: '',
      format: 'txt',
      path: file.name,
      addedAt: Date.now(),
      totalChapters: 1,
    }

    const chapters: Chapter[] = [
      {
        id: `${bookId}-ch-main`,
        title: name,
        level: 0,
        children: [],
      },
    ]

    const textMap = new Map<string, string>()
    textMap.set(`${bookId}-ch-main`, text)

    return {
      metadata,
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return text
      },
    }
  }
}
```

**Test:** `web/src/tests/txtParser.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { TxtParser } from '../core/books/parsers/txtParser'

describe('TxtParser', () => {
  it('должен парсить простой текстовый файл', async () => {
    const content = 'Hello, world!\nThis is a test.'
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    const parser = new TxtParser()
    const book = await parser.parse(file)

    expect(book.metadata.title).toBe('test')
    expect(book.metadata.format).toBe('txt')
    expect(book.metadata.totalChapters).toBe(1)
    expect(book.chapters).toHaveLength(1)
    expect(book.getText(book.chapters[0].id)).toBe(content)
  })

  it('должен возвращать весь текст через getAllText', async () => {
    const content = 'Line 1\nLine 2\nLine 3'
    const file = new File([content], 'book.txt', { type: 'text/plain' })
    const parser = new TxtParser()
    const book = await parser.parse(file)

    expect(book.getAllText()).toBe(content)
  })
})
```

**Verify:** `npx vitest run web/src/tests/txtParser.test.ts`

---

## Task 1.3: markdownParser.ts — Парсер Markdown файлов

**File:** `web/src/core/books/parsers/markdownParser.ts`
**Test:** `web/src/tests/markdownParser.test.ts`
**Depends:** 1.1

**Решение:** Создаётся новый парсер, отдельный от существующего `MarkdownAdapter` (который извлекает блоки кода). Новый парсер извлекает читаемый текст: заголовки → главы, тело → текст главы. Markdown-синтаксис (жирный, курсив, ссылки, код) вычищается.

```typescript
import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

interface HeadingMatch {
  level: number
  title: string
  startLine: number
  endLine: number
}

/**
 * Парсер для .md и .markdown файлов.
 * Извлекает структуру глав из заголовков (#, ##, ###).
 * Очищает markdown-синтаксис из текста.
 */
export class MarkdownParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const raw = await file.text()
    const lines = raw.split('\n')
    const name = file.name.replace(/\.[^/.]+$/, '')
    const bookId = crypto.randomUUID()

    // Находим все заголовки
    const headings: HeadingMatch[] = []
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        headings.push({
          level: match[1].length,
          title: match[2].trim(),
          startLine: i,
          endLine: i,
        })
      }
    }

    // Определяем границы каждой секции
    for (let i = 0; i < headings.length; i++) {
      headings[i].endLine = i + 1 < headings.length
        ? headings[i + 1].startLine
        : lines.length
    }

    // Если нет заголовков — вся книга одна глава
    const chapters: Chapter[] = []
    const textMap = new Map<string, string>()

    if (headings.length === 0) {
      const chId = `${bookId}-ch-main`
      chapters.push({
        id: chId,
        title: name,
        level: 0,
        children: [],
      })
      textMap.set(chId, this.stripMarkdown(lines.join('\n')))
    } else {
      // Строим дерево глав (простая flat структура для v1, level для indentation)
      for (const h of headings) {
        const chId = `${bookId}-ch-${this.slugify(h.title)}`
        const sectionLines = lines.slice(h.startLine + 1, h.endLine)
        const sectionText = this.stripMarkdown(sectionLines.join('\n')).trim()

        chapters.push({
          id: chId,
          title: h.title,
          level: h.level - 1, // # → 0, ## → 1, ### → 2
          children: [],
        })
        textMap.set(chId, sectionText)
      }
    }

    const metadata: BookMetadata = {
      id: bookId,
      title: name,
      author: '',
      format: 'md',
      path: file.name,
      addedAt: Date.now(),
      totalChapters: chapters.length,
    }

    return {
      metadata,
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return this.stripMarkdown(raw)
      },
    }
  }

  private stripMarkdown(text: string): string {
    return text
      // Убираем заголовки
      .replace(/^#{1,6}\s+/gm, '')
      // Убираем жирный/курсив
      .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
      // Убираем ссылки [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Убираем инлайн-код `code`
      .replace(/`([^`]+)`/g, '$1')
      // Убираем блоки кода ``` ```
      .replace(/```[\s\S]*?```/g, '')
      // Убираем image references
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Убираем горизонтальные линии
      .replace(/^---+\s*$/gm, '')
      // Убираем blockquotes
      .replace(/^>\s+/gm, '')
      // Убираем список маркеры
      .replace(/^[*-]\s+/gm, '')
      // Убираем нумерованные списки
      .replace(/^\d+\.\s+/gm, '')
      // Множественные newline → одиночные
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 64)
  }
}
```

**Test:** `web/src/tests/markdownParser.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { MarkdownParser } from '../core/books/parsers/markdownParser'

describe('MarkdownParser', () => {
  it('должен извлекать главы из заголовков', async () => {
    const md = `# Введение

Это введение.

## Установка

Как установить.

## Использование

Как использовать.

# Заключение

Финальные мысли.`

    const file = new File([md], 'guide.md', { type: 'text/markdown' })
    const parser = new MarkdownParser()
    const book = await parser.parse(file)

    expect(book.chapters).toHaveLength(4)
    expect(book.chapters[0].title).toBe('Введение')
    expect(book.chapters[0].level).toBe(0)
    expect(book.chapters[1].title).toBe('Установка')
    expect(book.chapters[1].level).toBe(1)
    expect(book.chapters[2].title).toBe('Использование')
    expect(book.chapters[2].level).toBe(1)
    expect(book.chapters[3].title).toBe('Заключение')
    expect(book.chapters[3].level).toBe(0)
  })

  it('должен очищать markdown-синтаксис из текста главы', async () => {
    const md = `# Chapter

This has **bold** and *italic* and [a link](https://example.com).`

    const file = new File([md], 'test.md', { type: 'text/markdown' })
    const parser = new MarkdownParser()
    const book = await parser.parse(file)

    const text = book.getText(book.chapters[0].id)
    expect(text).toContain('bold')
    expect(text).toContain('italic')
    expect(text).toContain('a link')
    expect(text).not.toContain('**')
    expect(text).not.toContain('https://example.com')
  })

  it('должен создавать одну главу для файла без заголовков', async () => {
    const md = 'Просто текст.\n\nЕщё текст.'
    const file = new File([md], 'notes.md', { type: 'text/markdown' })
    const parser = new MarkdownParser()
    const book = await parser.parse(file)

    expect(book.chapters).toHaveLength(1)
    expect(book.metadata.totalChapters).toBe(1)
    expect(book.getText(book.chapters[0].id)).toContain('Просто текст')
  })
})
```

**Verify:** `npx vitest run web/src/tests/markdownParser.test.ts`

---

## Task 1.4: progressManager.ts — Менеджер прогресса книг

**File:** `web/src/core/books/progressManager.ts`
**Test:** `web/src/tests/progressManager.test.ts`
**Depends:** 1.1

```typescript
import type { BookProgress } from './types'

const PROGRESS_PREFIX = 'gittype_book_progress_'
const RECENT_BOOKS_KEY = 'gittype_recent_books'
const MAX_RECENT_BOOKS = 20

export function getProgressKey(bookId: string): string {
  return `${PROGRESS_PREFIX}${bookId}`
}

export function loadProgress(bookId: string): BookProgress {
  try {
    const data = localStorage.getItem(getProgressKey(bookId))
    if (data) {
      const parsed = JSON.parse(data)
      return {
        completedChapters: parsed.completedChapters ?? [],
        lastPosition: parsed.lastPosition ?? {},
        completedAt: parsed.completedAt,
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { completedChapters: [], lastPosition: {} }
}

export function saveProgress(bookId: string, progress: BookProgress): void {
  try {
    localStorage.setItem(getProgressKey(bookId), JSON.stringify(progress))
  } catch {
    // localStorage full or unavailable
  }
}

export function clearProgress(bookId: string): void {
  try {
    localStorage.removeItem(getProgressKey(bookId))
  } catch {
    // ignore
  }
}

export interface RecentBookEntry {
  id: string
  title: string
  author: string
  format: string
  path: string
  addedAt: number
  completedChapters: number
  totalChapters: number
}

export function loadRecentBooks(): RecentBookEntry[] {
  try {
    const data = localStorage.getItem(RECENT_BOOKS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveRecentBooks(books: RecentBookEntry[]): void {
  try {
    localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(books.slice(0, MAX_RECENT_BOOKS)))
  } catch {
    // ignore
  }
}

export function addRecentBook(entry: RecentBookEntry): void {
  const books = loadRecentBooks().filter(b => b.id !== entry.id)
  books.unshift(entry)
  saveRecentBooks(books)
}

export function removeRecentBook(bookId: string): void {
  const books = loadRecentBooks().filter(b => b.id !== bookId)
  saveRecentBooks(books)
  clearProgress(bookId)
}
```

**Test:** `web/src/tests/progressManager.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadProgress,
  saveProgress,
  clearProgress,
  loadRecentBooks,
  saveRecentBooks,
  addRecentBook,
  removeRecentBook,
} from '../core/books/progressManager'
import type { BookProgress } from '../core/books/types'

beforeEach(() => {
  localStorage.clear()
})

describe('progressManager', () => {
  const bookId = 'test-book-123'

  it('должен возвращать пустой прогресс для новой книги', () => {
    const progress = loadProgress(bookId)
    expect(progress.completedChapters).toEqual([])
    expect(progress.lastPosition).toEqual({})
  })

  it('должен сохранять и загружать прогресс', () => {
    const progress: BookProgress = {
      completedChapters: ['ch1', 'ch2'],
      lastPosition: { ch1: 50, ch2: 120 },
    }
    saveProgress(bookId, progress)

    const loaded = loadProgress(bookId)
    expect(loaded.completedChapters).toEqual(['ch1', 'ch2'])
    expect(loaded.lastPosition).toEqual({ ch1: 50, ch2: 120 })
  })

  it('должен очищать прогресс', () => {
    saveProgress(bookId, { completedChapters: ['ch1'], lastPosition: {} })
    clearProgress(bookId)
    const progress = loadProgress(bookId)
    expect(progress.completedChapters).toEqual([])
  })

  it('должен управлять списком недавних книг', () => {
    const book1 = { id: 'b1', title: 'Book 1', author: '', format: 'txt', path: 'b1.txt', addedAt: 100, completedChapters: 0, totalChapters: 1 }
    const book2 = { id: 'b2', title: 'Book 2', author: '', format: 'md', path: 'b2.md', addedAt: 200, completedChapters: 1, totalChapters: 3 }

    saveRecentBooks([book1, book2])
    expect(loadRecentBooks()).toHaveLength(2)

    addRecentBook({ id: 'b3', title: 'Book 3', author: '', format: 'epub', path: 'b3.epub', addedAt: 300, completedChapters: 0, totalChapters: 5 })
    expect(loadRecentBooks()).toHaveLength(3)

    removeRecentBook('b1')
    expect(loadRecentBooks()).toHaveLength(2)
    expect(loadRecentBooks().find(b => b.id === 'b1')).toBeUndefined()
  })
})
```

**Verify:** `npx vitest run web/src/tests/progressManager.test.ts`

---

## Task 1.5: bookStore.ts — Zustand store для книг

**File:** `web/src/core/books/bookStore.ts`
**Test:** `web/src/tests/bookStore.test.ts`
**Depends:** 1.1, 1.4

**Решение:** Хранит: выбранную книгу, главы, текущую главу, прогресс, список недавних. Действия: установка книги, навигация по главам, сохранение прогресса. Состояние сериализуемо (тексты глав хранятся в `chapterTexts: Record<string, string>`).

```typescript
import { create } from 'zustand'
import type { BookMetadata, Chapter, BookFormat } from './types'
import {
  loadProgress,
  saveProgress,
  addRecentBook,
  removeRecentBook as removeRecentBookEntry,
  loadRecentBooks,
  type RecentBookEntry,
} from './progressManager'

interface BookState {
  // Выбранная книга
  selectedBook: BookMetadata | null
  chapters: Chapter[]
  currentChapterId: string | null
  currentChapterText: string
  chapterTexts: Record<string, string>

  // Прогресс
  completedChapters: string[]
  lastPosition: Record<string, number>

  // Недавние книги
  recentBooks: RecentBookEntry[]

  // Actions
  setBook: (metadata: BookMetadata, chapters: Chapter[], texts: Record<string, string>) => void
  clearBook: () => void
  setCurrentChapter: (chapterId: string) => void
  markChapterComplete: (chapterId: string) => void
  savePosition: (chapterId: string, position: number) => void
  removeRecentBook: (bookId: string) => void
  loadProgressFromStorage: (bookId: string) => void
  loadRecentBooksFromStorage: () => void
  getChapterProgress: (chapterId: string) => 'completed' | 'pending'
  getOverallProgress: () => { completed: number; total: number }
}

export const useBookStore = create<BookState>()((set, get) => ({
  selectedBook: null,
  chapters: [],
  currentChapterId: null,
  currentChapterText: '',
  chapterTexts: {},
  completedChapters: [],
  lastPosition: {},
  recentBooks: [],

  setBook: (metadata, chapters, texts) => {
    // Сохраняем в recent books
    addRecentBook({
      id: metadata.id,
      title: metadata.title,
      author: metadata.author,
      format: metadata.format,
      path: metadata.path,
      addedAt: metadata.addedAt,
      completedChapters: 0,
      totalChapters: metadata.totalChapters,
    })

    // Загружаем сохранённый прогресс
    const saved = loadProgress(metadata.id)

    set({
      selectedBook: metadata,
      chapters,
      chapterTexts: texts,
      completedChapters: saved.completedChapters,
      lastPosition: saved.lastPosition,
      currentChapterId: null,
      currentChapterText: '',
    })

    // Автоматически загружаем recentBooks
    get().loadRecentBooksFromStorage()
  },

  clearBook: () => {
    set({
      selectedBook: null,
      chapters: [],
      currentChapterId: null,
      currentChapterText: '',
      chapterTexts: {},
      completedChapters: [],
      lastPosition: {},
    })
  },

  setCurrentChapter: (chapterId) => {
    const { chapterTexts } = get()
    const text = chapterTexts[chapterId] || ''
    set({
      currentChapterId: chapterId,
      currentChapterText: text,
    })
  },

  markChapterComplete: (chapterId) => {
    const { completedChapters, selectedBook } = get()
    if (completedChapters.includes(chapterId)) return

    const newCompleted = [...completedChapters, chapterId]
    set({ completedChapters: newCompleted })

    if (selectedBook) {
      saveProgress(selectedBook.id, {
        completedChapters: newCompleted,
        lastPosition: get().lastPosition,
      })

      // Обновляем запись в recent books
      addRecentBook({
        id: selectedBook.id,
        title: selectedBook.title,
        author: selectedBook.author,
        format: selectedBook.format,
        path: selectedBook.path,
        addedAt: selectedBook.addedAt,
        completedChapters: newCompleted.length,
        totalChapters: selectedBook.totalChapters,
      })
    }
  },

  savePosition: (chapterId, position) => {
    const { lastPosition, selectedBook } = get()
    const newPositions = { ...lastPosition, [chapterId]: position }
    set({ lastPosition: newPositions })

    if (selectedBook) {
      saveProgress(selectedBook.id, {
        completedChapters: get().completedChapters,
        lastPosition: newPositions,
      })
    }
  },

  removeRecentBook: (bookId) => {
    removeRecentBookEntry(bookId)
    get().loadRecentBooksFromStorage()
  },

  loadProgressFromStorage: (bookId) => {
    const saved = loadProgress(bookId)
    set({
      completedChapters: saved.completedChapters,
      lastPosition: saved.lastPosition,
    })
  },

  loadRecentBooksFromStorage: () => {
    set({ recentBooks: loadRecentBooks() })
  },

  getChapterProgress: (chapterId) => {
    return get().completedChapters.includes(chapterId) ? 'completed' : 'pending'
  },

  getOverallProgress: () => {
    const { completedChapters, selectedBook } = get()
    return {
      completed: completedChapters.length,
      total: selectedBook?.totalChapters ?? 0,
    }
  },
}))
```

**Test:** `web/src/tests/bookStore.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useBookStore } from '../core/books/bookStore'

beforeEach(() => {
  localStorage.clear()
  useBookStore.setState({
    selectedBook: null,
    chapters: [],
    currentChapterId: null,
    currentChapterText: '',
    chapterTexts: {},
    completedChapters: [],
    lastPosition: {},
    recentBooks: [],
  })
})

describe('bookStore', () => {
  it('должен устанавливать книгу', () => {
    const store = useBookStore.getState()
    store.setBook(
      {
        id: 'b1',
        title: 'Test Book',
        author: 'Author',
        format: 'txt',
        path: 'test.txt',
        addedAt: Date.now(),
        totalChapters: 2,
      },
      [
        { id: 'ch1', title: 'Chapter 1', level: 0, children: [] },
        { id: 'ch2', title: 'Chapter 2', level: 0, children: [] },
      ],
      {
        ch1: 'Text of chapter 1',
        ch2: 'Text of chapter 2',
      }
    )

    const state = useBookStore.getState()
    expect(state.selectedBook?.title).toBe('Test Book')
    expect(state.chapters).toHaveLength(2)
    expect(state.chapterTexts['ch1']).toBe('Text of chapter 1')
  })

  it('должен переключать текущую главу', () => {
    const store = useBookStore.getState()
    store.setBook(
      { id: 'b1', title: 'Test', author: '', format: 'txt', path: 't.txt', addedAt: 0, totalChapters: 2 },
      [{ id: 'c1', title: 'Ch1', level: 0, children: [] }, { id: 'c2', title: 'Ch2', level: 0, children: [] }],
      { c1: 'Hello', c2: 'World' }
    )

    useBookStore.getState().setCurrentChapter('c2')
    const state = useBookStore.getState()
    expect(state.currentChapterId).toBe('c2')
    expect(state.currentChapterText).toBe('World')
  })

  it('должен отмечать главу как завершённую', () => {
    const store = useBookStore.getState()
    store.setBook(
      { id: 'b2', title: 'Test', author: '', format: 'txt', path: 't.txt', addedAt: 0, totalChapters: 1 },
      [{ id: 'c1', title: 'Ch1', level: 0, children: [] }],
      { c1: 'Text' }
    )

    useBookStore.getState().markChapterComplete('c1')
    expect(useBookStore.getState().completedChapters).toContain('c1')
    expect(useBookStore.getState().getChapterProgress('c1')).toBe('completed')
  })

  it('должен сохранять позицию', () => {
    useBookStore.getState().savePosition('c1', 42)
    expect(useBookStore.getState().lastPosition['c1']).toBe(42)
  })

  it('должен очищать книгу', () => {
    const store = useBookStore.getState()
    store.setBook(
      { id: 'b3', title: 'Test', author: '', format: 'txt', path: 't.txt', addedAt: 0, totalChapters: 1 },
      [{ id: 'c1', title: 'Ch1', level: 0, children: [] }],
      { c1: 'Text' }
    )
    useBookStore.getState().clearBook()

    const state = useBookStore.getState()
    expect(state.selectedBook).toBeNull()
    expect(state.chapters).toHaveLength(0)
    expect(state.currentChapterText).toBe('')
  })

  it('должен возвращать общий прогресс', () => {
    const store = useBookStore.getState()
    store.setBook(
      { id: 'b4', title: 'Test', author: '', format: 'txt', path: 't.txt', addedAt: 0, totalChapters: 3 },
      [
        { id: 'c1', title: 'Ch1', level: 0, children: [] },
        { id: 'c2', title: 'Ch2', level: 0, children: [] },
        { id: 'c3', title: 'Ch3', level: 0, children: [] },
      ],
      { c1: 'A', c2: 'B', c3: 'C' }
    )

    useBookStore.getState().markChapterComplete('c1')
    useBookStore.getState().markChapterComplete('c2')

    const progress = useBookStore.getState().getOverallProgress()
    expect(progress.completed).toBe(2)
    expect(progress.total).toBe(3)
  })
})
```

**Verify:** `npx vitest run web/src/tests/bookStore.test.ts`

---

# Batch 2: UI Components (parallel — 4 implementers, depends on Batch 1)

---

## Task 2.1: BookSelector.tsx — Экран выбора книги

**File:** `web/src/features/books/BookSelector.tsx`
**Test:** none (UI component, тестируется через ручную проверку)
**Depends:** 1.5

**Решение:** Отрисовывает welcome-экран для книг: кнопка выбора файла, список недавних книг с прогрессом. При выборе файла — парсит через соответствующий парсер, сохраняет в store. После парсинга переходит к показу глав (автоматически).

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { useBookStore } from '../../core/books/bookStore'
import { TxtParser } from '../../core/books/parsers/txtParser'
import { MarkdownParser } from '../../core/books/parsers/markdownParser'
import { MAX_BOOK_FILE_SIZE } from '../../core/books/types'
import type { BookParser, BookFormat } from '../../core/books/types'
import './BookSelector.css'

type ParserMap = Record<string, BookParser>

const PARSERS: ParserMap = {
  txt: new TxtParser(),
  md: new MarkdownParser(),
  markdown: new MarkdownParser(),
}

const ACCEPTED_EXTENSIONS = '.txt,.md,.markdown,.epub'

/**
 * Определяет парсер по расширению файла
 */
function getParser(fileName: string): BookParser | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return PARSERS[ext] || null
}

export function BookSelector() {
  const setView = useAppStore((s) => s.setView)
  const { setBook, recentBooks, loadRecentBooksFromStorage, removeRecentBook, selectedBook, chapters } = useBookStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загружаем недавние книги при монтировании
  useEffect(() => {
    loadRecentBooksFromStorage()
  }, [loadRecentBooksFromStorage])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Проверка размера
    if (file.size > MAX_BOOK_FILE_SIZE) {
      setError(`Файл слишком большой (макс. ${MAX_BOOK_FILE_SIZE / 1024 / 1024}MB)`)
      return
    }

    const parser = getParser(file.name)
    if (!parser) {
      setError(`Неподдерживаемый формат: ${file.name}`)
      return
    }

    setIsParsing(true)
    try {
      const parsedBook = await parser.parse(file)

      // Собираем тексты всех глав
      const texts: Record<string, string> = {}
      const collectTexts = (chapters: typeof parsedBook.chapters) => {
        for (const ch of chapters) {
          texts[ch.id] = parsedBook.getText(ch.id)
          if (ch.children.length > 0) collectTexts(ch.children)
        }
      }
      collectTexts(parsedBook.chapters)

      setBook(parsedBook.metadata, parsedBook.chapters, texts)

      // Авто-выбираем первую главу
      if (parsedBook.chapters.length > 0) {
        useBookStore.getState().setCurrentChapter(parsedBook.chapters[0].id)
      }

      // Устанавливаем текст для Trainer
      if (parsedBook.chapters.length > 0) {
        const firstText = parsedBook.getText(parsedBook.chapters[0].id)
        useAppStore.getState().setFileContent(firstText)
        useAppStore.getState().setSelectedFile(`book://${parsedBook.metadata.id}/${parsedBook.chapters[0].id}`)
        useAppStore.getState().resetTrainer()
      }

      // Переключаемся на Trainer
      setView('trainer')
    } catch (err) {
      setError(`Ошибка при открытии файла: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setIsParsing(false)
      // Сбрасываем input, чтобы можно было выбрать тот же файл снова
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [setBook, setView])

  const handleRemoveBook = useCallback((bookId: string) => {
    removeRecentBook(bookId)
  }, [removeRecentBook])

  const handleOpenRecent = useCallback((entry: typeof recentBooks[0]) => {
    // Для v1: показываем сообщение, что нужно перезагрузить файл
    setError(`Файл "${entry.title}" нужно открыть заново. Выберите файл на диске.`)
  }, [])

  return (
    <div className="book-selector">
      <div className="book-selector-header">
        <h1 className="book-selector-title">📖 Книги</h1>
        <p className="book-selector-subtitle">
          Тренируйтесь печатать на текстах из книг
        </p>
      </div>

      {/* Кнопка выбора файла */}
      <div className="book-upload-area">
        <button
          className="book-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsing}
        >
          {isParsing ? '⏳ Открытие...' : '📂 Выбрать файл'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <p className="book-upload-hint">
          Поддерживаются: TXT, Markdown (.md), EPUB
        </p>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="book-error">
          <span>⚠️</span> {error}
          <button className="book-error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Список недавних книг */}
      {recentBooks.length > 0 && (
        <div className="book-recent-section">
          <h2 className="book-recent-title">Недавние книги</h2>
          <div className="book-recent-list">
            {recentBooks.map((book) => {
              const progressPct = book.totalChapters > 0
                ? Math.round((book.completedChapters / book.totalChapters) * 100)
                : 0
              return (
                <div key={book.id} className="book-recent-card">
                  <div className="book-card-info" onClick={() => handleOpenRecent(book)}>
                    <div className="book-card-title">{book.title}</div>
                    {book.author && <div className="book-card-author">{book.author}</div>}
                    <div className="book-card-meta">
                      <span className="book-format-badge" data-format={book.format}>
                        {book.format.toUpperCase()}
                      </span>
                      <span className="book-card-progress">
                        {book.completedChapters}/{book.totalChapters} глав
                      </span>
                    </div>
                    <div className="book-progress-bar">
                      <div
                        className="book-progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <button
                    className="book-card-delete"
                    onClick={() => handleRemoveBook(book.id)}
                    title="Удалить из списка"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Кнопка возврата к репозиториям */}
      <div className="book-back-section">
        <button
          className="book-back-btn"
          onClick={() => setView('repo-select')}
        >
          ← К репозиториям
        </button>
      </div>
    </div>
  )
}
```

---

## Task 2.2: BookSelector.css — Стили экрана выбора книг

**File:** `web/src/features/books/BookSelector.css`
**Depends:** 2.1

**Решение:** Использует существующие CSS-переменные темы GitType для консистентного вида с RepoSelector.

```css
/* ===== Book Selector (welcome screen) ===== */

.book-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
  gap: 2rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.book-selector-header {
  text-align: center;
}

.book-selector-title {
  font-size: 2.2rem;
  margin: 0;
  color: var(--main-color, #e2b714);
}

.book-selector-subtitle {
  margin: 0.5rem 0 0;
  color: var(--sub-color, #646669);
  font-size: 1rem;
}

/* Upload area */
.book-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.book-upload-btn {
  background: var(--main-color, #e2b714);
  color: var(--bg-color, #323437);
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font-mono, 'Fira Code', monospace);
}

.book-upload-btn:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
}

.book-upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.book-upload-hint {
  color: var(--sub-color, #646669);
  font-size: 0.8rem;
  margin: 0;
}

/* Error message */
.book-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 80, 80, 0.15);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: var(--text-color, #d1d0c5);
  padding: 0.6rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  max-width: 480px;
}

.book-error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--sub-color, #646669);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.1rem 0.3rem;
}

/* Recent books */
.book-recent-section {
  width: 100%;
  max-width: 520px;
}

.book-recent-title {
  font-size: 1rem;
  color: var(--sub-color, #646669);
  margin: 0 0 0.75rem;
  font-weight: 500;
}

.book-recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-recent-card {
  display: flex;
  align-items: center;
  background: rgba(100, 102, 105, 0.1);
  border: 1px solid rgba(100, 102, 105, 0.2);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  transition: all 0.15s;
  cursor: pointer;
}

.book-recent-card:hover {
  background: rgba(100, 102, 105, 0.2);
  border-color: var(--main-color, #e2b714);
}

.book-card-info {
  flex: 1;
  min-width: 0;
}

.book-card-title {
  font-size: 0.95rem;
  color: var(--text-color, #d1d0c5);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card-author {
  font-size: 0.8rem;
  color: var(--sub-color, #646669);
  margin-top: 0.1rem;
}

.book-card-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.3rem;
}

.book-format-badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  background: rgba(100, 102, 105, 0.3);
  color: var(--sub-color, #646669);
  font-weight: 600;
}

.book-format-badge[data-format="epub"] {
  background: rgba(80, 200, 120, 0.2);
  color: #50c878;
}

.book-format-badge[data-format="pdf"] {
  background: rgba(255, 80, 80, 0.2);
  color: #ff5050;
}

.book-format-badge[data-format="md"] {
  background: rgba(80, 160, 255, 0.2);
  color: #50a0ff;
}

.book-card-progress {
  font-size: 0.75rem;
  color: var(--sub-color, #646669);
}

.book-progress-bar {
  height: 3px;
  background: rgba(100, 102, 105, 0.3);
  border-radius: 2px;
  margin-top: 0.4rem;
  overflow: hidden;
}

.book-progress-fill {
  height: 100%;
  background: var(--main-color, #e2b714);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.book-card-delete {
  background: none;
  border: none;
  color: var(--sub-color, #646669);
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
  border-radius: 3px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.book-card-delete:hover {
  color: #ff5050;
  background: rgba(255, 80, 80, 0.1);
}

/* Back button */
.book-back-section {
  margin-top: 1rem;
}

.book-back-btn {
  background: none;
  border: 1px solid rgba(100, 102, 105, 0.4);
  color: var(--sub-color, #646669);
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: var(--font-mono, 'Fira Code', monospace);
  transition: all 0.15s;
}

.book-back-btn:hover {
  border-color: var(--main-color, #e2b714);
  color: var(--main-color, #e2b714);
}
```

---

## Task 2.3: BookTree.tsx — Древовидное оглавление книги

**File:** `web/src/features/books/BookTree.tsx`
**Test:** none (UI component)
**Depends:** 1.5

**Решение:** Рекурсивно рендерит главы. Показывает уровень заголовка (отступ), название, статус (completed/pending). При клике — выбирает главу и передаёт текст в Trainer.

```typescript
import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { useBookStore } from '../../core/books/bookStore'
import type { Chapter } from '../../core/books/types'
import './BookTree.css'

export function BookTree() {
  const { chapters, selectedBook, currentChapterId, completedChapters, setCurrentChapter } =
    useBookStore(
      useShallow((state) => ({
        chapters: state.chapters,
        selectedBook: state.selectedBook,
        currentChapterId: state.currentChapterId,
        completedChapters: state.completedChapters,
        setCurrentChapter: state.setCurrentChapter,
      }))
    )

  const setFileContent = useAppStore((s) => s.setFileContent)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)
  const setView = useAppStore((s) => s.setView)
  const resetTrainer = useAppStore((s) => s.resetTrainer)
  const chapterTexts = useBookStore((s) => s.chapterTexts)

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())

  const handleChapterClick = useCallback((chapter: Chapter) => {
    setCurrentChapter(chapter.id)

    // Устанавливаем текст в appStore для Trainer
    const text = chapterTexts[chapter.id] || ''
    setFileContent(text)
    setSelectedFile(`book://${selectedBook?.id}/${chapter.id}`)
    resetTrainer()

    // Переключаемся на Trainer
    setView('trainer')
  }, [setCurrentChapter, chapterTexts, setFileContent, setSelectedFile, resetTrainer, setView, selectedBook?.id])

  const toggleExpand = useCallback((id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renderChapter = (chapter: Chapter, depth: number = 0) => {
    const hasChildren = chapter.children.length > 0
    const isSelected = currentChapterId === chapter.id
    const isCompleted = completedChapters.includes(chapter.id)
    const isExpanded = expandedChapters.has(chapter.id)

    return (
      <div key={chapter.id} className="book-tree-node">
        <div
          className={`book-tree-item ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${0.5 + depth * 1.2}rem` }}
        >
          {hasChildren && (
            <button
              className="book-tree-expand"
              onClick={() => toggleExpand(chapter.id)}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
          {!hasChildren && <span className="book-tree-spacer" />}
          <button
            className="book-tree-chapter"
            onClick={() => handleChapterClick(chapter)}
          >
            <span className="book-tree-level-indicator">
              {chapter.level === 0 ? '📖' : chapter.level === 1 ? '📄' : '•'}
            </span>
            <span className="book-tree-title" title={chapter.title}>
              {chapter.title}
            </span>
            {isCompleted && (
              <span className="book-tree-check">✓</span>
            )}
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="book-tree-children">
            {chapter.children.map(child => renderChapter(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="book-tree">
      <div className="book-tree-header">
        <span className="book-tree-book-title" title={selectedBook?.title}>
          📖 {selectedBook?.title || 'Книга'}
        </span>
      </div>
      <div className="book-tree-content">
        {chapters.length === 0 ? (
          <div className="book-tree-empty">Нет глав</div>
        ) : (
          chapters.map(ch => renderChapter(ch, 0))
        )}
      </div>
    </div>
  )
}
```

---

## Task 2.4: BookTree.css — Стили оглавления

**File:** `web/src/features/books/BookTree.css`
**Depends:** 2.3

```css
/* ===== Book Tree (sidebar) ===== */

.book-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.book-tree-header {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid rgba(100, 102, 105, 0.2);
  flex-shrink: 0;
}

.book-tree-book-title {
  font-size: 0.85rem;
  color: var(--text-color, #d1d0c5);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.book-tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.book-tree-empty {
  color: var(--sub-color, #646669);
  font-size: 0.8rem;
  text-align: center;
  padding: 1rem;
}

.book-tree-node {
  user-select: none;
}

.book-tree-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem 0.75rem;
  transition: background 0.1s;
  border-radius: 0;
}

.book-tree-item:hover {
  background: rgba(100, 102, 105, 0.15);
}

.book-tree-item.active {
  background: rgba(226, 183, 20, 0.1);
  border-left: 2px solid var(--main-color, #e2b714);
}

.book-tree-expand {
  background: none;
  border: none;
  color: var(--sub-color, #646669);
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  font-size: 0.7rem;
  width: 1rem;
  text-align: center;
  flex-shrink: 0;
}

.book-tree-spacer {
  width: 1rem;
  flex-shrink: 0;
}

.book-tree-chapter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: var(--text-color, #d1d0c5);
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  font-size: 0.8rem;
  flex: 1;
  min-width: 0;
  text-align: left;
  font-family: var(--font-mono, 'Fira Code', monospace);
}

.book-tree-level-indicator {
  font-size: 0.75rem;
  flex-shrink: 0;
}

.book-tree-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.book-tree-check {
  color: var(--main-color, #e2b714);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.book-tree-children {
  margin-left: 0.5rem;
}

/* Scrollbar styling */
.book-tree-content::-webkit-scrollbar {
  width: 4px;
}

.book-tree-content::-webkit-scrollbar-track {
  background: transparent;
}

.book-tree-content::-webkit-scrollbar-thumb {
  background: rgba(100, 102, 105, 0.3);
  border-radius: 2px;
}
```

---

# Batch 3: Integration (serial — depends on Batch 2)

---

## Task 3.1: appStore.ts — Расширение типа AppView

**File:** `web/src/store/appStore.ts`
**Test:** none
**Depends:** none

**Изменение:** Добавить `'book-select'` в union тип `AppView`.

Изменить строку 7:
```diff
- export type AppView = 'repo-select' | 'trainer'
+ export type AppView = 'repo-select' | 'book-select' | 'trainer'
```

**Verify:** `npx tsc --noEmit` (без ошибок)

---

## Task 3.2: RepoSelector.tsx — Кнопка "Книги"

**File:** `web/src/features/repo-selection/RepoSelector.tsx`
**Test:** none
**Depends:** 3.1

**Изменение:** В компонент `RepoSelectorLarge` добавить кнопку "📖 Книги", которая переключает view. Импортировать `setView` из appStore.

1. Добавить импорт `setView`:
```diff
- const { token, setToken, selectedRepo, setSelectedRepo } = useAppStore(
+ const { token, setToken, selectedRepo, setSelectedRepo, setView } = useAppStore(
    useShallow((state) => ({
      token: state.token,
      setToken: state.setToken,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
+     setView: state.setView,
    }))
  )
```

2. Добавить кнопку после формы ввода репозитория, перед блоком `selectedRepo`:
```diff
  {/* Search dropdown */}
  ... (существующий код dropdown)

+       {/* Переключатель на книги */}
+       <div className="repo-books-toggle" style={{ marginTop: '1rem' }}>
+         <button
+           className="books-nav-btn"
+           onClick={() => setView('book-select')}
+           style={{
+             background: 'none',
+             border: '1px solid rgba(100,102,105,0.4)',
+             color: 'var(--sub-color, #646669)',
+             padding: '0.5rem 1.2rem',
+             borderRadius: '4px',
+             cursor: 'pointer',
+             fontSize: '0.85rem',
+             fontFamily: 'var(--font-mono, monospace)',
+             transition: 'all 0.15s',
+           }}
+           onMouseEnter={(e) => {
+             e.currentTarget.style.borderColor = 'var(--main-color, #e2b714)'
+             e.currentTarget.style.color = 'var(--main-color, #e2b714)'
+           }}
+           onMouseLeave={(e) => {
+             e.currentTarget.style.borderColor = 'rgba(100,102,105,0.4)'
+             e.currentTarget.style.color = 'var(--sub-color, #646669)'
+           }}
+         >
+           📖 Книги
+         </button>
+       </div>

  {selectedRepo && (
    <div className="selected-repo-badge">
```

---

## Task 3.3: App.tsx — Интеграция модуля книг

**File:** `web/src/App.tsx`
**Test:** `web/src/tests/books-integration.test.ts`
**Depends:** 2.1, 2.3, 3.1, 3.2

**Изменения:**

1. **Импорты** — добавить BookSelector, BookTree, useBookStore
2. **Рендер main** — заменить условие `!selectedRepo` на `view === 'repo-select'` и добавить `view === 'book-select'`
3. **Сайдбар** — добавить BookTree при выбранной книге
4. **При переключении с книги на репозиторий** — восстановить предыдущее состояние репозитория

Полный diff:

```diff
  import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
  import { useShallow } from 'zustand/shallow'
  import { useAppStore } from './store/appStore'
+ import { useBookStore } from './core/books/bookStore'
  import { githubClient } from './core/github/githubClient'
  import { buildFileTree, filterTreeByExtension, buildLearningPath } from './core/repository/treeBuilder'
  import { extractCodeBlocks, getRandomBlock, extractImports, buildBlockTree, BlockTreeNode } from './core/ast/blockExtractor'
  import { RepoSelector, RepoSelectorLarge } from './features/repo-selection/RepoSelector'
+ import { BookSelector } from './features/books/BookSelector'
+ import { BookTree } from './features/books/BookTree'
  import { FileTree } from './features/file-tree/FileTree'
  import { Trainer } from './features/trainer/Trainer'
  import { Settings, AppSettings } from './components/Settings'
  import './App.css'

  function App() {
    const {
      // ... existing ...
      view,
      // ... existing ...
    } = useAppStore(...)

+   // Книжный модуль
+   const selectedBook = useBookStore((s) => s.selectedBook)
+   const bookChapters = useBookStore((s) => s.chapters)

    // ... existing state ...

    // ==== ИЗМЕНИТЬ РЕНДЕР MAIN ====
    // Было:
-   {!selectedRepo ? (
-     <div className="welcome-screen">
-       <div className="welcome-content">
-         <div className="welcome-icon">⌨️</div>
-         <h1>GitType</h1>
-         <p className="welcome-subtitle">Тренажёр слепой печати на реальном коде из GitHub</p>
-         <RepoSelectorLarge />
-         <div className="welcome-steps">...</div>
-       </div>
-     </div>
-   ) : selectedFile ? (
-     <Trainer ... />
-   ) : (
-     <div className="no-file-screen">...</div>
-   )}

+   {/* ===== MAIN CONTENT — view-based switching ===== */}
+   <main className="app-main">
+     {view === 'repo-select' && (
+       <div className="welcome-screen">
+         <div className="welcome-content">
+           <div className="welcome-icon">⌨️</div>
+           <h1>GitType</h1>
+           <p className="welcome-subtitle">Тренажёр слепой печати на реальном коде из GitHub</p>
+           <RepoSelectorLarge />
+           <div className="welcome-steps">
+             <div className="step">
+               <span className="step-number">1</span>
+               <span className="step-text">Введите токен и репозиторий выше</span>
+             </div>
+             <div className="step">
+               <span className="step-number">2</span>
+               <span className="step-text">Выберите файл из дерева слева</span>
+             </div>
+             <div className="step">
+               <span className="step-number">3</span>
+               <span className="step-text">Начните печатать!</span>
+             </div>
+           </div>
+         </div>
+       </div>
+     )}
+
+     {view === 'book-select' && <BookSelector />}
+
+     {view === 'trainer' && (
+       selectedFile ? (
+         <Trainer ... />
+       ) : (
+         <div className="no-file-screen">
+           <div className="no-file-content">
+             <div className="no-file-icon">📂</div>
+             <h2>Выберите главу</h2>
+             <p>Выберите главу из оглавления книги или файл из репозитория</p>
+           </div>
+         </div>
+       )
+     )}
+   </main>

    // ==== ИЗМЕНИТЬ САЙДБАР ====
    // В левом сайдбаре, вместо условия fileTree.length:
    // Было:
    {sidebarCollapsed ? (
      <div className="sidebar-collapsed-hint">
        <span>{treeMode === 'tree' ? '📁' : '🛣️'}</span>
      </div>
    ) : (
      <div className="sidebar-content">
        {treeMode === 'tree' ? (
          <FileTree ... />
        ) : (
          <div className="learning-plan">...</div>
        )}
      </div>
    )}

    // Стало:
+   {selectedBook && bookChapters.length > 0 ? (
+     // === BOOK MODE ===
+     sidebarCollapsed ? (
+       <div className="sidebar-collapsed-hint">
+         <span>📖</span>
+       </div>
+     ) : (
+       <div className="sidebar-content">
+         <BookTree />
+       </div>
+     )
+   ) : (
+     // === REPO MODE (original) ===
+     sidebarCollapsed ? (
+       <div className="sidebar-collapsed-hint">
+         <span>{treeMode === 'tree' ? '📁' : '🛣️'}</span>
+       </div>
+     ) : (
+       <div className="sidebar-content">
+         {treeMode === 'tree' ? (
+           <FileTree ... />
+         ) : (
+           <div className="learning-plan">...</div>
+         )}
+       </div>
+     )
+   )}
```

**Note:** Полный изменённый файл App.tsx доступен в приложении к этому плану. Основная логика:
- `view` определяет, что показывать в центре (`repo-select` → Welcome, `book-select` → BookSelector, `trainer` → Trainer)
- Сайдбар переключается между FileTree/Plan (репозитории) и BookTree (книги) на основе `selectedBook`
- При завершении главы в Trainer — вызываем `bookStore.markChapterComplete`
- При рестарте Trainer (Tab) — сбрасываем только ввод, не сбрасываем книгу

**Дополнительное изменение:** В Trainer нужно вызвать `markChapterComplete` при завершении. Сейчас Trainer вызывает `addCompletedFile`/`addCompletedBlock` из appStore. Для книг нужно вызывать `markChapterComplete` из bookStore.

**Решение:** В App.tsx добавить эффект, который отслеживает завершение тренировки и отмечает главу книги:

```typescript
// В App.tsx, после вызова useAppStore и useBookStore:
const isComplete = useAppStore((s) => s.isComplete)
const currentChapterId = useBookStore((s) => s.currentChapterId)
const selectedBook = useBookStore((s) => s.selectedBook)
const markChapterComplete = useBookStore((s) => s.markChapterComplete)

// Когда тренировка завершена — отмечаем главу книги
useEffect(() => {
  if (isComplete && selectedBook && currentChapterId) {
    markChapterComplete(currentChapterId)
  }
}, [isComplete, selectedBook, currentChapterId, markChapterComplete])
```

---

# Batch 4: EPUB Phase 2 (parallel — depends on Batch 1)

---

## Task 4.1: Установка jszip

**File:** `web/package.json` (модификация)
**Depends:** none

```bash
cd web && bun add jszip
```

---

## Task 4.2: epubParser.ts — Парсер EPUB файлов

**File:** `web/src/core/books/parsers/epubParser.ts`
**Test:** `web/src/tests/epubParser.test.ts`
**Depends:** 1.1, 4.1

**Решение:** Использует JSZip для распаковки EPUB (формат ZIP + XHTML + OPF). Извлекает: метаданные из OPF, оглавление из NCX/toc.ncx, текст глав из XHTML файлов.

```typescript
import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

/**
 * Простой EPUB парсер.
 * Распаковывает ZIP, читает OPF манифест, извлекает главы из XHTML.
 * Для v1 — минимальная реализация: только текст, без стилей и картинок.
 */
export class EpubParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)

    // Ищем OPF файл (container.xml → rootfile)
    const containerXml = await this.readEntry(zip, 'META-INF/container.xml')
    if (!containerXml) throw new Error('EPUB: container.xml not found')

    const opfPath = this.extractOpfPath(containerXml)
    if (!opfPath) throw new Error('EPUB: OPF path not found')

    const opfXml = await this.readEntry(zip, opfPath)
    if (!opfXml) throw new Error('EPUB: OPF file not found')

    const baseDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)
    const metadata = this.extractMetadata(opfXml, file.name, baseDir, file)

    // Извлекаем список XHTML файлов (главы) из OPF
    const spineItems = this.extractSpineItems(opfXml, baseDir)
    const chapters: Chapter[] = []
    const textMap = new Map<string, string>()

    for (let i = 0; i < spineItems.length; i++) {
      const item = spineItems[i]
      const chapterId = `${metadata.id}-ch-${i}`
      let html = await this.readEntry(zip, item.path)

      if (!html) {
        // Пробуем без baseDir
        html = await this.readEntry(zip, item.path.replace(baseDir, ''))
      }

      const cleanText = html ? this.extractTextFromHtml(html) : ''
      const title = item.title || `Chapter ${i + 1}`

      chapters.push({
        id: chapterId,
        title,
        level: 0,
        children: [],
      })
      textMap.set(chapterId, cleanText)
    }

    // Если нет глав из spine — пробуем найти все XHTML/HTML файлы
    if (chapters.length === 0) {
      const htmlFiles = Object.keys(zip.files).filter(
        f => f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm')
      ).sort()

      for (let i = 0; i < htmlFiles.length; i++) {
        const chapterId = `${metadata.id}-ch-${i}`
        const html = await this.readEntry(zip, htmlFiles[i])
        const cleanText = html ? this.extractTextFromHtml(html) : ''

        chapters.push({
          id: chapterId,
          title: htmlFiles[i].split('/').pop()?.replace(/\.[^/.]+$/, '') || `Chapter ${i + 1}`,
          level: 0,
          children: [],
        })
        textMap.set(chapterId, cleanText)
      }
    }

    return {
      metadata: { ...metadata, totalChapters: chapters.length },
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return Array.from(textMap.values()).join('\n\n')
      },
    }
  }

  private async readEntry(zip: any, path: string): Promise<string | null> {
    const entry = zip.files[path]
    if (!entry || entry.dir) return null
    try {
      const content = await entry.async('text')
      // EPUB файлы обычно в UTF-8, но могут быть и в других кодировках
      // Для v1 — считаем что UTF-8
      return content
    } catch {
      return null
    }
  }

  private extractOpfPath(containerXml: string): string | null {
    const match = containerXml.match(/rootfile[^>]*full-path="([^"]+)"/i)
    return match ? match[1] : null
  }

  private extractMetadata(
    opfXml: string,
    fileName: string,
    _baseDir: string,
    file: File
  ): Omit<BookMetadata, 'totalChapters'> {
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)
    const title = titleMatch ? this.decodeXml(titleMatch[1]) : fileName.replace(/\.[^/.]+$/, '')
    const author = authorMatch ? this.decodeXml(authorMatch[1]) : ''

    return {
      id: crypto.randomUUID(),
      title,
      author,
      format: 'epub',
      path: fileName,
      addedAt: Date.now(),
    }
  }

  private extractSpineItems(opfXml: string, baseDir: string): Array<{ path: string; title: string }> {
    const items: Array<{ path: string; title: string }> = []
    const itemRefs: string[] = []

    // Извлекаем idrefs из spine
    const spineMatches = opfXml.matchAll(/<itemref[^>]*idref="([^"]+)"/gi)
    for (const match of spineMatches) {
      itemRefs.push(match[1])
    }

    // Извлекаем manifest items
    const itemMatches = opfXml.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="application\/xhtml\+xml"[^>]*\/?>/gi)
    const itemMap = new Map<string, string>()
    for (const match of itemMatches) {
      itemMap.set(match[1], match[2])
    }

    // Собираем spine
    for (const ref of itemRefs) {
      const href = itemMap.get(ref)
      if (href) {
        items.push({
          path: baseDir + href,
          title: ref,
        })
      }
    }

    return items
  }

  private extractTextFromHtml(html: string): string {
    // Убираем <script> и <style> блоки
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Убираем все HTML теги
    text = text.replace(/<[^>]+>/g, '')
    // Декодируем HTML entities
    text = text.replace(/&nbsp;/g, ' ')
    text = text.replace(/&amp;/g, '&')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&#39;/g, "'")
    text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // Множественные пробелы → один
    text = text.replace(/[ \t]+/g, ' ')
    // Множественные newline → двойные
    text = text.replace(/\n{3,}/g, '\n\n')
    return text.trim()
  }

  private decodeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }
}
```

**Test:** `web/src/tests/epubParser.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { EpubParser } from '../core/books/parsers/epubParser'

describe('EpubParser', () => {
  it('должен парсить EPUB файл', async () => {
    // Создаём минимальный EPUB (ZIP с container.xml, OPF, XHTML)
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    // META-INF/container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

    // OEBPS/content.opf
    zip.file('OEBPS/content.opf', `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata>
    <dc:title>Test EPUB</dc:title>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`)

    // OEBPS/chapter1.xhtml
    zip.file('OEBPS/chapter1.xhtml', `<?xml version="1.0"?>
<html><body>
<h1>Chapter 1</h1>
<p>This is the first chapter content.</p>
</body></html>`)

    // OEBPS/chapter2.xhtml
    zip.file('OEBPS/chapter2.xhtml', `<?xml version="1.0"?>
<html><body>
<h1>Chapter 2</h1>
<p>This is the second chapter.</p>
<p>With multiple paragraphs.</p>
</body></html>`)

    const epubBlob = await zip.generateAsync({ type: 'blob' })
    const file = new File([epubBlob], 'test.epub', { type: 'application/epub+zip' })

    const parser = new EpubParser()
    const book = await parser.parse(file)

    expect(book.metadata.title).toBe('Test EPUB')
    expect(book.metadata.author).toBe('Test Author')
    expect(book.metadata.format).toBe('epub')
    expect(book.chapters.length).toBeGreaterThanOrEqual(2)
    expect(book.getText(book.chapters[0].id)).toContain('first chapter')
    expect(book.getText(book.chapters[1].id)).toContain('second chapter')
  }, 10000)
})
```

**Verify:** `npx vitest run web/src/tests/epubParser.test.ts`

---

# Appendices

## Appendix A: Полный App.tsx (после изменений)

Ключевые изменения в `web/src/App.tsx`:

1. **Новые импорты** (в начало файла):
```typescript
import { useBookStore } from './core/books/bookStore'
import { BookSelector } from './features/books/BookSelector'
import { BookTree } from './features/books/BookTree'
```

2. **Новые селекторы** (в блоке useAppStore):
```typescript
// В компоненте App, после существующего useAppStore:
const selectedBook = useBookStore((s) => s.selectedBook)
const bookChapters = useBookStore((s) => s.chapters)
const bookCurrentChapter = useBookStore((s) => s.currentChapterId)
const markChapterComplete = useBookStore((s) => s.markChapterComplete)
```

3. **Эффект завершения главы книги** (после существующих эффектов):
```typescript
// Когда тренировка завершена — отмечаем главу книги
const isComplete = useAppStore((s) => s.isComplete)
useEffect(() => {
  if (isComplete && selectedBook && bookCurrentChapter) {
    markChapterComplete(bookCurrentChapter)
  }
}, [isComplete, selectedBook, bookCurrentChapter, markChapterComplete])
```

4. **Авто-расширение сайдбара для книг** (рядом с существующим `useEffect` для `fileTree`):
```typescript
// Авто-разворачиваем sidebar когда выбрана книга
useEffect(() => {
  if (selectedBook && sidebarCollapsed) {
    setSidebarCollapsed(false)
  }
}, [selectedBook])
```

5. **Замена рендера main** (см. diff выше)

6. **Замена рендера left sidebar** (см. diff выше)

---

## Appendix B: Порядок реализации

| Шаг | Что делать | Кто |
|-----|-----------|-----|
| 1 | Создать `core/books/types.ts` | Разработчик A |
| 2 | Создать `core/books/parsers/txtParser.ts` + тест | Разработчик B |
| 3 | Создать `core/books/parsers/markdownParser.ts` + тест | Разработчик C |
| 4 | Создать `core/books/progressManager.ts` + тест | Разработчик D |
| 5 | Создать `core/books/bookStore.ts` + тест | Разработчик E |
| 6 | Создать `features/books/BookSelector.tsx` + CSS | Разработчик F |
| 7 | Создать `features/books/BookTree.tsx` + CSS | Разработчик G |
| 8 | Модифицировать `store/appStore.ts` (1 строка) | Разработчик H |
| 9 | Модифицировать `features/repo-selection/RepoSelector.tsx` | Разработчик I |
| 10 | Модифицировать `App.tsx` — интеграция | Разработчик J |
| 11 | Установить jszip | Разработчик K |
| 12 | Создать `core/books/parsers/epubParser.ts` + тест | Разработчик L |

Шаги 1-5 выполняются параллельно.
Шаги 6-7 зависят от 1-5.
Шаг 8 независим.
Шаги 9-10 зависят от 6-8.
Шаги 11-12 параллельны с 2-10.

---

## Appendix C: Принцип работы интеграции

**Как книга попадает в Trainer:**

1. Пользователь нажимает "📖 Книги" на welcome-экране
2. `setView('book-select')` → рендерится `BookSelector`
3. Пользователь выбирает файл → BookSelector парсит его
4. BookSelector вызывает `bookStore.setBook()` (сохраняет метаданные + главы + тексты)
5. BookSelector вызывает `appStore.setFileContent(text)` (устанавливает текст первой главы)
6. BookSelector вызывает `appStore.setSelectedFile('book://id/chapterId')` (виртуальный путь)
7. BookSelector вызывает `setView('trainer')` → рендерится Trainer, который читает `fileContent`
8. В левом сайдбаре рендерится BookTree (так как `selectedBook` не null)
9. При клике на другую главу в BookTree: `setFileContent(newText)` + `setSelectedFile(newPath)` + `resetTrainer()`
10. При завершении печати: `bookStore.markChapterComplete(chapterId)` через useEffect
11. При нажатии Tab (рестарт): Trainer вызывает `resetTrainer()` — только сбрасывает ввод, не трогает книгу

**Как вернуться к репозиториям:**

1. Пользователь нажимает "← К репозиториям" в BookSelector
2. `setView('repo-select')` → рендерится welcome-экран
3. Если репозиторий был выбран ранее — данные сохранились в appStore, достаточно выбрать файл снова
4. При выборе файла из репозитория — `fileContent` перезаписывается содержимым файла репозитория

---

## Appendix D: Тестирование

| Тест | Файл | Что проверяет |
|------|------|--------------|
| txtParser | `tests/txtParser.test.ts` | Парсинг TXT, одна глава, getText, getAllText |
| markdownParser | `tests/markdownParser.test.ts` | Разбивка на главы, очистка markdown, файл без заголовков |
| progressManager | `tests/progressManager.test.ts` | load/save/clear, recent books add/remove |
| bookStore | `tests/bookStore.test.ts` | setBook, setCurrentChapter, markChapterComplete, clearBook, progress |
| epubParser | `tests/epubParser.test.ts` | Распаковка EPUB, извлечение метаданных и текста глав |
| integration | `tests/books-integration.test.ts` | (ручное) Выбор книги → глава → Trainer |

**Команды запуска:**

```bash
cd web

# Все тесты книг
npx vitest run web/src/tests/txtParser.test.ts web/src/tests/markdownParser.test.ts web/src/tests/progressManager.test.ts web/src/tests/bookStore.test.ts

# EPUB тест (после установки jszip)
npx vitest run web/src/tests/epubParser.test.ts

# Проверка TypeScript
npx tsc --noEmit

# Все тесты проекта
npm test
```
