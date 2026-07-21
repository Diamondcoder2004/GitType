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
