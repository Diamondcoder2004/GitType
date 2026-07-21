import { describe, it, expect } from 'vitest'
import { MarkdownParser } from '../core/books/parsers/markdownParser'

describe('MarkdownParser', () => {
  it('должен извлекать главы из заголовков', async () => {
    const md = `# Введение\n\nЭто введение.\n\n## Установка\n\nКак установить.\n\n## Использование\n\nКак использовать.\n\n# Заключение\n\nФинальные мысли.`

    const file = new File([md], 'guide.md', { type: 'text/markdown' })
    const parser = new MarkdownParser()
    const book = await parser.parse(file)

    expect(book.chapters).toHaveLength(4)
    expect(book.chapters[0].title).toBe('Введение')
    expect(book.chapters[0].level).toBe(0)
    expect(book.chapters[1].title).toBe('Установка')
    expect(book.chapters[1].level).toBe(1)
    expect(book.chapters[2].title).toBe('Использование')
    expect(book.chapters[2].level).toBe(1)
    expect(book.chapters[3].title).toBe('Заключение')
    expect(book.chapters[3].level).toBe(0)
  })

  it('должен очищать markdown-синтаксис из текста главы', async () => {
    const md = `# Chapter\n\nThis has **bold** and *italic* and [a link](https://example.com).`

    const file = new File([md], 'test.md', { type: 'text/markdown' })
    const parser = new MarkdownParser()
    const book = await parser.parse(file)

    const text = book.getText(book.chapters[0].id)
    expect(text).toContain('bold')
    expect(text).toContain('italic')
    expect(text).toContain('a link')
    expect(text).not.toContain('**')
    expect(text).not.toContain('https://example.com')
  })

  it('должен создавать одну главу для файла без заголовков', async () => {
    const md = 'Просто текст.\n\nЕщё текст.'
    const file = new File([md], 'notes.md', { type: 'text/markdown' })
    const parser = new MarkdownParser()
    const book = await parser.parse(file)

    expect(book.chapters).toHaveLength(1)
    expect(book.metadata.totalChapters).toBe(1)
    expect(book.getText(book.chapters[0].id)).toContain('Просто текст')
  })
})
