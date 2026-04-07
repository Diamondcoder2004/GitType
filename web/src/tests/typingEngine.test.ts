import { describe, it, expect } from 'vitest'
import { processTyping, getCharStatuses, normalizeChar } from '../core/typing/typingEngine'

describe('processTyping', () => {
  it('должен правильно определять правильные символы', () => {
    const result = processTyping('hello', 'hello')

    expect(result.correctChars).toBe(5)
    expect(result.errors).toBe(0)
    expect(result.accuracy).toBe(100)
    expect(result.completed).toBe(true)
  })

  it('должен определять ошибки', () => {
    const result = processTyping('hello', 'hxllo')

    expect(result.correctChars).toBe(4)
    expect(result.errors).toBe(1)
    expect(result.accuracy).toBe(80)
  })

  it('должен считать незавершённый ввод', () => {
    const result = processTyping('hello', 'hel')

    expect(result.correctChars).toBe(3)
    expect(result.errors).toBe(0)
    expect(result.completed).toBe(false)
  })

  it('должен считать ошибки при лишнем вводе', () => {
    const result = processTyping('hi', 'hello')

    expect(result.errors).toBe(3) // l, l, o - лишние
  })

  it('должен возвращать 100% точности для пустого ввода', () => {
    const result = processTyping('hello', '')

    expect(result.accuracy).toBe(100)
  })

  it('должен корректно обрабатывать стрелочные функции =>', () => {
    const target = 'const fn = () => {}'
    const userInput = 'const fn = () => {}'

    const result = processTyping(target, userInput)
    expect(result.correctChars).toBe(target.length)
    expect(result.errors).toBe(0)
    expect(result.completed).toBe(true)
  })

  it('должен корректно обрабатывать отдельные символы > и =', () => {
    const statuses = getCharStatuses('a => b', 'a => b')
    expect(statuses).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct', 'correct',
    ])
  })

  it('должен нормализовать curly quotes к ASCII', () => {
    // Curly double quotes
    expect(normalizeChar('\u201C')).toBe('"')
    expect(normalizeChar('\u201D')).toBe('"')
    // Curly single quotes
    expect(normalizeChar('\u2018')).toBe("'")
    expect(normalizeChar('\u2019')).toBe("'")
  })

  it('должен нормализовать разные виды тире к дефису', () => {
    expect(normalizeChar('\u2013')).toBe('-')  // en-dash
    expect(normalizeChar('\u2014')).toBe('-')  // em-dash
    expect(normalizeChar('\u2212')).toBe('-')  // minus sign
  })

  it('должен нормализовать non-breaking space к обычному пробелу', () => {
    expect(normalizeChar('\u00A0')).toBe(' ')
  })

  it('должен удалять zero-width space', () => {
    expect(normalizeChar('\u200B')).toBe('')
  })
})

describe('getCharStatuses', () => {
  it('должен возвращать статусы для каждого символа', () => {
    const statuses = getCharStatuses('hello', 'hel')
    
    expect(statuses).toEqual([
      'correct',
      'correct',
      'correct',
      'current',
      'pending',
    ])
  })

  it('должен помечать неправильные символы', () => {
    const statuses = getCharStatuses('hello', 'hxloo')
    
    expect(statuses).toEqual([
      'correct',
      'incorrect',
      'correct',
      'correct',
      'correct',
    ])
  })
})
