import { describe, it, expect } from 'vitest'
import { calculateConsistency, calculateBurstSpeed, generateWordsText } from '@core/typing/typingUtils'
import { CodeBlock } from '@core/ast/languageAdapter'

describe('calculateConsistency', () => {
  it('должен возвращать 100% для идеального ввода', () => {
    const consistency = calculateConsistency('hello world', 'hello world')
    expect(consistency).toBe(100)
  })

  it('должен снижать процент при ошибках', () => {
    const consistency = calculateConsistency('hello world', 'hxllo w0rld')
    expect(consistency).toBeLessThan(100)
  })

  it('должен возвращать 100% для короткого ввода', () => {
    const consistency = calculateConsistency('hello', 'hel')
    expect(consistency).toBe(100)
  })
})

describe('calculateBurstSpeed', () => {
  it('должен возвращать 0 для пустого ввода', () => {
    const burst = calculateBurstSpeed('', null)
    expect(burst).toBe(0)
  })

  it('должен возвращать 0 для слишком короткого ввода', () => {
    const burst = calculateBurstSpeed('abc', Date.now())
    expect(burst).toBe(0)
  })

  it('должен рассчитывать burst speed', () => {
    const startTime = Date.now() - 10000 // 10 секунд назад
    const burst = calculateBurstSpeed('hello world test', startTime)
    expect(burst).toBeGreaterThan(0)
  })
})

describe('generateWordsText', () => {
  const mockCodeBlocks: CodeBlock[] = [
    { id: '1', code: 'function hello() { return world }', type: 'function', name: 'hello', complexity: 1, startLine: 1, endLine: 1 },
    { id: '2', code: 'function test() { return 42 }', type: 'function', name: 'test', complexity: 1, startLine: 2, endLine: 2 },
  ]

  it('должен генерировать текст из указанного количества слов', () => {
    const text = generateWordsText(mockCodeBlocks, 5)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    expect(words.length).toBeLessThanOrEqual(5)
  })

  it('должен возвращать пустую строку для пустых блоков', () => {
    const text = generateWordsText([], 10)
    expect(text).toBe('')
  })

  it('должен возвращать текст меньше или равный запрошенному количеству слов', () => {
    const text = generateWordsText(mockCodeBlocks, 100)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    expect(words.length).toBeLessThanOrEqual(100)
  })
})
