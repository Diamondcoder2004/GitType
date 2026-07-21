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
