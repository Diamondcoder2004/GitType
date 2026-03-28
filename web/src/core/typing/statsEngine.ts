export interface TypingStats {
  cpm: number // characters per minute
  wpm: number // words per minute (cpm / 5)
  accuracy: number
  duration: number // seconds
  totalChars: number
  correctChars: number
  errors: number
}

export interface TimingData {
  startTime: number
  endTime: number
}

/**
 * Вычисляет статистику печати
 * Pure function
 */
export function calculateStats(
  startTime: number,
  endTime: number,
  totalChars: number,
  correctChars: number,
  errors: number
): TypingStats {
  const durationMs = endTime - startTime
  const duration = Math.round(durationMs / 1000) // seconds
  const durationMinutes = durationMs / 1000 / 60

  const cpm = durationMinutes > 0 ? Math.round((correctChars / durationMinutes)) : 0
  const wpm = durationMinutes > 0 ? Math.round((correctChars / 5) / durationMinutes) : 0
  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100

  return {
    cpm,
    wpm,
    accuracy,
    duration,
    totalChars,
    correctChars,
    errors,
  }
}

/**
 * Форматирует статистику для отображения
 */
export function formatStats(stats: TypingStats): string {
  return `CPM: ${stats.cpm} | WPM: ${stats.wpm} | Accuracy: ${stats.accuracy}% | Time: ${stats.duration}s`
}

/**
 * Сравнивает две статистики и возвращает улучшение/ухудшение
 */
export function compareStats(
  current: TypingStats,
  previous: TypingStats | null
): { cpmChange: number; wpmChange: number; accuracyChange: number } {
  if (!previous) {
    return { cpmChange: 0, wpmChange: 0, accuracyChange: 0 }
  }

  return {
    cpmChange: current.cpm - previous.cpm,
    wpmChange: current.wpm - previous.wpm,
    accuracyChange: current.accuracy - previous.accuracy,
  }
}

/**
 * Вычисляет среднюю статистику из массива результатов
 */
export function calculateAverageStats(statsArray: TypingStats[]): TypingStats {
  if (statsArray.length === 0) {
    return {
      cpm: 0,
      wpm: 0,
      accuracy: 0,
      duration: 0,
      totalChars: 0,
      correctChars: 0,
      errors: 0,
    }
  }

  const sum = statsArray.reduce(
    (acc, stats) => ({
      cpm: acc.cpm + stats.cpm,
      wpm: acc.wpm + stats.wpm,
      accuracy: acc.accuracy + stats.accuracy,
      duration: acc.duration + stats.duration,
      totalChars: acc.totalChars + stats.totalChars,
      correctChars: acc.correctChars + stats.correctChars,
      errors: acc.errors + stats.errors,
    }),
    {
      cpm: 0,
      wpm: 0,
      accuracy: 0,
      duration: 0,
      totalChars: 0,
      correctChars: 0,
      errors: 0,
    }
  )

  const count = statsArray.length

  return {
    cpm: Math.round(sum.cpm / count),
    wpm: Math.round(sum.wpm / count),
    accuracy: Math.round(sum.accuracy / count),
    duration: Math.round(sum.duration / count),
    totalChars: Math.round(sum.totalChars / count),
    correctChars: Math.round(sum.correctChars / count),
    errors: Math.round(sum.errors / count),
  }
}
