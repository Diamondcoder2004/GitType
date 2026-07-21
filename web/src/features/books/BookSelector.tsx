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
