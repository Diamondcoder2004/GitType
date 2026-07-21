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
