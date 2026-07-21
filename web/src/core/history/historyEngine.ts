import { TypingStats } from '../typing/statsEngine'

/**
 * Запись одной тренировочной сессии
 */
export interface SessionRecord {
  id: string
  timestamp: number
  /** WPM — слова в минуту */
  wpm: number
  /** CPM — символы в минуту */
  cpm: number
  /** Точность (0-100) */
  accuracy: number
  /** Количество ошибок */
  errors: number
  /** Длительность в секундах */
  duration: number
  /** Всего символов */
  totalChars: number
  /** Правильно набранных символов */
  correctChars: number
  /** Режим тренировки */
  mode: 'full-file' | 'code-block'
  /** Путь к файлу */
  filePath: string
  /** Имя блока (если code-block) */
  blockName?: string
  /** Репозиторий owner/repo */
  repo?: string
}

/**
 * Персональные рекорды
 */
export interface PersonalBests {
  bestWpm: number
  bestAccuracy: number
  bestCpm: number
  /** Дата рекорда WPM */
  bestWpmDate: number
}

const STORAGE_KEY = 'gittype_history'
const MAX_SESSIONS = 200

/**
 * Генерирует уникальный ID для сессии
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Загружает историю из localStorage
 */
export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

/**
 * Сохраняет историю в localStorage
 */
export function saveHistory(sessions: SessionRecord[]): void {
  // Обрезаем до лимита, оставляем самые новые
  const trimmed = sessions.slice(-MAX_SESSIONS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

/**
 * Добавляет новую сессию в историю
 * Возвращает обновлённую историю и флаг нового рекорда
 */
export function addSession(
  stats: TypingStats,
  mode: 'full-file' | 'code-block',
  filePath: string,
  blockName?: string,
  repo?: string
): { history: SessionRecord[]; isNewBest: boolean; record: SessionRecord } {
  const history = loadHistory()

  const record: SessionRecord = {
    id: generateId(),
    timestamp: Date.now(),
    wpm: stats.wpm,
    cpm: stats.cpm,
    accuracy: stats.accuracy,
    errors: stats.errors,
    duration: stats.duration,
    totalChars: stats.totalChars,
    correctChars: stats.correctChars,
    mode,
    filePath,
    blockName,
    repo,
  }

  const prevBests = getPersonalBests(history)
  const isNewBest = record.wpm > prevBests.bestWpm

  history.push(record)
  saveHistory(history)

  return { history, isNewBest, record }
}

/**
 * Вычисляет персональные рекорды из истории
 */
export function getPersonalBests(sessions: SessionRecord[]): PersonalBests {
  if (sessions.length === 0) {
    return { bestWpm: 0, bestAccuracy: 0, bestCpm: 0, bestWpmDate: 0 }
  }

  let bestWpm = 0
  let bestAccuracy = 0
  let bestCpm = 0
  let bestWpmDate = 0

  for (const s of sessions) {
    if (s.wpm > bestWpm) {
      bestWpm = s.wpm
      bestWpmDate = s.timestamp
    }
    if (s.accuracy > bestAccuracy) bestAccuracy = s.accuracy
    if (s.cpm > bestCpm) bestCpm = s.cpm
  }

  return { bestWpm, bestAccuracy, bestCpm, bestWpmDate }
}

/**
 * Вычисляет средние показатели за последние N сессий
 */
export function getAverageStats(
  sessions: SessionRecord[],
  lastN?: number
): { avgWpm: number; avgAccuracy: number; avgCpm: number; totalSessions: number } {
  const slice = lastN ? sessions.slice(-lastN) : sessions
  if (slice.length === 0) {
    return { avgWpm: 0, avgAccuracy: 0, avgCpm: 0, totalSessions: 0 }
  }

  const sum = slice.reduce(
    (acc, s) => ({
      wpm: acc.wpm + s.wpm,
      accuracy: acc.accuracy + s.accuracy,
      cpm: acc.cpm + s.cpm,
    }),
    { wpm: 0, accuracy: 0, cpm: 0 }
  )

  return {
    avgWpm: Math.round(sum.wpm / slice.length),
    avgAccuracy: Math.round(sum.accuracy / slice.length),
    avgCpm: Math.round(sum.cpm / slice.length),
    totalSessions: slice.length,
  }
}

/**
 * Фильтрует историю по режиму
 */
export function filterByMode(
  sessions: SessionRecord[],
  mode: 'all' | 'full-file' | 'code-block'
): SessionRecord[] {
  if (mode === 'all') return sessions
  return sessions.filter((s) => s.mode === mode)
}

/**
 * Группирует сессии по дням (для графика)
 * Возвращает массив { date, avgWpm, avgAccuracy, sessions }
 */
export function groupByDay(
  sessions: SessionRecord[]
): Array<{ date: string; avgWpm: number; avgAccuracy: number; sessions: number }> {
  const groups = new Map<string, SessionRecord[]>()

  for (const s of sessions) {
    const date = new Date(s.timestamp).toISOString().slice(0, 10) // YYYY-MM-DD
    const group = groups.get(date) || []
    group.push(s)
    groups.set(date, group)
  }

  return Array.from(groups.entries())
    .map(([date, recs]) => ({
      date,
      avgWpm: Math.round(recs.reduce((sum, r) => sum + r.wpm, 0) / recs.length),
      avgAccuracy: Math.round(recs.reduce((sum, r) => sum + r.accuracy, 0) / recs.length),
      sessions: recs.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Очищает всю историю
 */
export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Экспортирует историю в JSON-строку
 */
export function exportHistory(): string {
  return localStorage.getItem(STORAGE_KEY) || '[]'
}

/**
 * Форматирует дату для отображения
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)

  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays < 7) return `${diffDays} дн. назад`

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}
