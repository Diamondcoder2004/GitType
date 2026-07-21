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
