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
