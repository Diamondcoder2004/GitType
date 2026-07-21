import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadHistory,
  saveHistory,
  addSession,
  getPersonalBests,
  getAverageStats,
  filterByMode,
  groupByDay,
  clearHistory,
  exportHistory,
  formatDate,
  SessionRecord,
} from '../core/history/historyEngine'
import { TypingStats } from '../core/typing/statsEngine'

// Мок localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

const makeStats = (overrides: Partial<TypingStats> = {}): TypingStats => ({
  cpm: 200,
  wpm: 40,
  accuracy: 95,
  duration: 60,
  totalChars: 200,
  correctChars: 190,
  errors: 10,
  ...overrides,
})

describe('historyEngine', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('loadHistory / saveHistory', () => {
    it('возвращает пустой массив когда нет данных', () => {
      expect(loadHistory()).toEqual([])
    })

    it('возвращает пустой массив при невалидном JSON', () => {
      localStorageMock.setItem('gittype_history', 'invalid')
      expect(loadHistory()).toEqual([])
    })

    it('сохраняет и загружает историю', () => {
      const sessions: SessionRecord[] = [
        {
          id: '1', timestamp: Date.now(), wpm: 40, cpm: 200,
          accuracy: 95, errors: 5, duration: 60, totalChars: 200,
          correctChars: 190, mode: 'full-file', filePath: 'test.ts',
        },
      ]
      saveHistory(sessions)
      expect(loadHistory()).toEqual(sessions)
    })

    it('обрезает до 200 записей', () => {
      const sessions: SessionRecord[] = Array.from({ length: 250 }, (_, i) => ({
        id: String(i), timestamp: i, wpm: 40, cpm: 200,
        accuracy: 95, errors: 5, duration: 60, totalChars: 200,
        correctChars: 190, mode: 'full-file' as const, filePath: 'test.ts',
      }))
      saveHistory(sessions)
      const loaded = loadHistory()
      expect(loaded.length).toBe(200)
      // Должны остаться последние 200 (id 50-249)
      expect(loaded[0].id).toBe('50')
    })
  })

  describe('addSession', () => {
    it('добавляет сессию и возвращает результат', () => {
      const stats = makeStats({ wpm: 50 })
      const result = addSession(stats, 'code-block', 'src/app.ts', 'main', 'user/repo')

      expect(result.record.wpm).toBe(50)
      expect(result.record.mode).toBe('code-block')
      expect(result.record.filePath).toBe('src/app.ts')
      expect(result.record.blockName).toBe('main')
      expect(result.record.repo).toBe('user/repo')
      expect(result.history.length).toBe(1)
    })

    it('определяет новый рекорд WPM', () => {
      addSession(makeStats({ wpm: 30 }), 'full-file', 'a.ts')
      const result = addSession(makeStats({ wpm: 50 }), 'full-file', 'b.ts')
      expect(result.isNewBest).toBe(true)
    })

    it('не помечает как рекорд если WPM ниже', () => {
      addSession(makeStats({ wpm: 50 }), 'full-file', 'a.ts')
      const result = addSession(makeStats({ wpm: 30 }), 'full-file', 'b.ts')
      expect(result.isNewBest).toBe(false)
    })
  })

  describe('getPersonalBests', () => {
    it('возвращает нули при пустой истории', () => {
      const bests = getPersonalBests([])
      expect(bests.bestWpm).toBe(0)
      expect(bests.bestAccuracy).toBe(0)
      expect(bests.bestCpm).toBe(0)
    })

    it('находит максимальные значения', () => {
      const sessions: SessionRecord[] = [
        { id: '1', timestamp: 1000, wpm: 30, cpm: 150, accuracy: 90, errors: 10, duration: 60, totalChars: 150, correctChars: 135, mode: 'full-file', filePath: 'a.ts' },
        { id: '2', timestamp: 2000, wpm: 50, cpm: 250, accuracy: 98, errors: 2, duration: 60, totalChars: 250, correctChars: 245, mode: 'full-file', filePath: 'b.ts' },
        { id: '3', timestamp: 3000, wpm: 40, cpm: 200, accuracy: 95, errors: 5, duration: 60, totalChars: 200, correctChars: 190, mode: 'full-file', filePath: 'c.ts' },
      ]
      const bests = getPersonalBests(sessions)
      expect(bests.bestWpm).toBe(50)
      expect(bests.bestAccuracy).toBe(98)
      expect(bests.bestCpm).toBe(250)
      expect(bests.bestWpmDate).toBe(2000)
    })
  })

  describe('getAverageStats', () => {
    it('считает средние по последним N', () => {
      const sessions: SessionRecord[] = [
        { id: '1', timestamp: 1, wpm: 20, cpm: 100, accuracy: 80, errors: 20, duration: 60, totalChars: 100, correctChars: 80, mode: 'full-file', filePath: 'a.ts' },
        { id: '2', timestamp: 2, wpm: 40, cpm: 200, accuracy: 90, errors: 10, duration: 60, totalChars: 200, correctChars: 180, mode: 'full-file', filePath: 'b.ts' },
        { id: '3', timestamp: 3, wpm: 60, cpm: 300, accuracy: 100, errors: 0, duration: 60, totalChars: 300, correctChars: 300, mode: 'full-file', filePath: 'c.ts' },
      ]
      // Среднее по последним 2: wpm=(40+60)/2=50, acc=(90+100)/2=95
      const avg = getAverageStats(sessions, 2)
      expect(avg.avgWpm).toBe(50)
      expect(avg.avgAccuracy).toBe(95)
      expect(avg.totalSessions).toBe(2)
    })
  })

  describe('filterByMode', () => {
    const sessions: SessionRecord[] = [
      { id: '1', timestamp: 1, wpm: 30, cpm: 150, accuracy: 90, errors: 5, duration: 30, totalChars: 75, correctChars: 67, mode: 'full-file', filePath: 'a.ts' },
      { id: '2', timestamp: 2, wpm: 40, cpm: 200, accuracy: 95, errors: 3, duration: 40, totalChars: 133, correctChars: 126, mode: 'code-block', filePath: 'b.ts' },
    ]

    it('all возвращает всё', () => {
      expect(filterByMode(sessions, 'all').length).toBe(2)
    })

    it('фильтрует по full-file', () => {
      const result = filterByMode(sessions, 'full-file')
      expect(result.length).toBe(1)
      expect(result[0].id).toBe('1')
    })

    it('фильтрует по code-block', () => {
      const result = filterByMode(sessions, 'code-block')
      expect(result.length).toBe(1)
      expect(result[0].id).toBe('2')
    })
  })

  describe('groupByDay', () => {
    it('группирует сессии по дням', () => {
      const day1 = new Date('2025-01-15T10:00:00').getTime()
      const day1b = new Date('2025-01-15T18:00:00').getTime()
      const day2 = new Date('2025-01-16T12:00:00').getTime()

      const sessions: SessionRecord[] = [
        { id: '1', timestamp: day1, wpm: 30, cpm: 150, accuracy: 90, errors: 5, duration: 30, totalChars: 75, correctChars: 67, mode: 'full-file', filePath: 'a.ts' },
        { id: '2', timestamp: day1b, wpm: 50, cpm: 250, accuracy: 100, errors: 0, duration: 50, totalChars: 208, correctChars: 208, mode: 'full-file', filePath: 'b.ts' },
        { id: '3', timestamp: day2, wpm: 40, cpm: 200, accuracy: 95, errors: 3, duration: 40, totalChars: 133, correctChars: 126, mode: 'full-file', filePath: 'c.ts' },
      ]
      const groups = groupByDay(sessions)
      expect(groups.length).toBe(2)
      expect(groups[0].date).toBe('2025-01-15')
      expect(groups[0].sessions).toBe(2)
      expect(groups[0].avgWpm).toBe(40) // (30+50)/2
      expect(groups[1].date).toBe('2025-01-16')
      expect(groups[1].sessions).toBe(1)
    })
  })

  describe('clearHistory', () => {
    it('очищает историю', () => {
      addSession(makeStats(), 'full-file', 'test.ts')
      expect(loadHistory().length).toBe(1)
      clearHistory()
      expect(loadHistory().length).toBe(0)
    })
  })

  describe('exportHistory', () => {
    it('экспортирует JSON', () => {
      addSession(makeStats(), 'full-file', 'test.ts')
      const exported = exportHistory()
      const parsed = JSON.parse(exported)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
    })
  })

  describe('formatDate', () => {
    it('показывает "только что" для свежих записей', () => {
      expect(formatDate(Date.now())).toBe('только что')
    })

    it('показывает минуты', () => {
      expect(formatDate(Date.now() - 5 * 60 * 1000)).toBe('5 мин. назад')
    })

    it('показывает часы', () => {
      expect(formatDate(Date.now() - 3 * 60 * 60 * 1000)).toBe('3 ч. назад')
    })

    it('показывает дни', () => {
      expect(formatDate(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('2 дн. назад')
    })
  })
})
