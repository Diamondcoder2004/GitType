import { describe, it, expect } from 'vitest'
import { processTyping, getCharStatuses } from '@core/typing/typingEngine'

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
