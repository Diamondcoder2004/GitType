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
