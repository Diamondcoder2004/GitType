import { describe, it, expect } from 'vitest'
import { calculateStats, calculateAverageStats } from '@core/typing/statsEngine'

describe('calculateStats', () => {
  it('должен рассчитывать WPM и CPM', () => {
    const startTime = 0
    const endTime = 60000 // 1 минута
    const totalChars = 100
    const correctChars = 95
    const errors = 5

    const stats = calculateStats(startTime, endTime, totalChars, correctChars, errors)

    expect(stats.wpm).toBe(19) // 95 / 5 / 1 = 19
    expect(stats.cpm).toBe(95) // 95 / 1 = 95
    expect(stats.accuracy).toBe(95)
    expect(stats.duration).toBe(60)
  })

  it('должен возвращать 0 для нулевого времени', () => {
    const stats = calculateStats(100, 100, 100, 95, 5)

    expect(stats.wpm).toBe(0)
    expect(stats.cpm).toBe(0)
  })

  it('должен рассчитывать точность', () => {
    const stats = calculateStats(0, 60000, 100, 90, 10)

    expect(stats.accuracy).toBe(90)
  })
})

describe('calculateAverageStats', () => {
  it('должен вычислять среднюю статистику', () => {
    const statsArray = [
      { cpm: 100, wpm: 20, accuracy: 95, duration: 60, totalChars: 100, correctChars: 95, errors: 5 },
      { cpm: 120, wpm: 24, accuracy: 90, duration: 60, totalChars: 120, correctChars: 108, errors: 12 },
    ]

    const avg = calculateAverageStats(statsArray)

    expect(avg.cpm).toBe(110)
    expect(avg.wpm).toBe(22)
    expect(avg.accuracy).toBe(92) // среднее между 95 и 90
  })

  it('должен возвращать нули для пустого массива', () => {
    const avg = calculateAverageStats([])

    expect(avg.cpm).toBe(0)
    expect(avg.wpm).toBe(0)
  })
})
