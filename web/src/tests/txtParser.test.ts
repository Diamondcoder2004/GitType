import { describe, it, expect } from 'vitest'
import { TxtParser } from '../core/books/parsers/txtParser'

describe('TxtParser', () => {
  it('должен парсить простой текстовый файл', async () => {
    const content = 'Hello, world!\nThis is a test.'
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    const parser = new TxtParser()
    const book = await parser.parse(file)

    expect(book.metadata.title).toBe('test')
    expect(book.metadata.format).toBe('txt')
    expect(book.metadata.totalChapters).toBe(1)
    expect(book.chapters).toHaveLength(1)
    expect(book.getText(book.chapters[0].id)).toBe(content)
  })

  it('должен возвращать весь текст через getAllText', async () => {
    const content = 'Line 1\nLine 2\nLine 3'
    const file = new File([content], 'book.txt', { type: 'text/plain' })
    const parser = new TxtParser()
    const book = await parser.parse(file)

    expect(book.getAllText()).toBe(content)
  })
})
