import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

interface HeadingMatch {
  level: number
  title: string
  startLine: number
  endLine: number
}

/**
 * Парсер для .md и .markdown файлов.
 * Извлекает структуру глав из заголовков (#, ##, ###).
 * Очищает markdown-синтаксис из текста.
 */
export class MarkdownParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const raw = await file.text()
    const lines = raw.split('\n')
    const name = file.name.replace(/\.[^/.]+$/, '')
    const bookId = crypto.randomUUID()

    // Находим все заголовки
    const headings: HeadingMatch[] = []
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        headings.push({
          level: match[1].length,
          title: match[2].trim(),
          startLine: i,
          endLine: i,
        })
      }
    }

    // Определяем границы каждой секции
    for (let i = 0; i < headings.length; i++) {
      headings[i].endLine = i + 1 < headings.length
        ? headings[i + 1].startLine
        : lines.length
    }

    // Если нет заголовков — вся книга одна глава
    const chapters: Chapter[] = []
    const textMap = new Map<string, string>()

    if (headings.length === 0) {
      const chId = `${bookId}-ch-main`
      chapters.push({
        id: chId,
        title: name,
        level: 0,
        children: [],
      })
      textMap.set(chId, this.stripMarkdown(lines.join('\n')))
    } else {
      // Строим дерево глав (простая flat структура для v1, level для indentation)
      for (const h of headings) {
        const chId = `${bookId}-ch-${this.slugify(h.title)}`
        const sectionLines = lines.slice(h.startLine + 1, h.endLine)
        const sectionText = this.stripMarkdown(sectionLines.join('\n')).trim()

        chapters.push({
          id: chId,
          title: h.title,
          level: h.level - 1, // # → 0, ## → 1, ### → 2
          children: [],
        })
        textMap.set(chId, sectionText)
      }
    }

    const metadata: BookMetadata = {
      id: bookId,
      title: name,
      author: '',
      format: 'md',
      path: file.name,
      addedAt: Date.now(),
      totalChapters: chapters.length,
    }

    const stripMd = (text: string) => this.stripMarkdown(text)

    return {
      metadata,
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return stripMd(raw)
      },
    }
  }

  private stripMarkdown(text: string): string {
    return text
      // Убираем заголовки
      .replace(/^#{1,6}\s+/gm, '')
      // Убираем жирный/курсив
      .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
      // Убираем ссылки [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Убираем инлайн-код `code`
      .replace(/`([^`]+)`/g, '$1')
      // Убираем блоки кода ``` ```
      .replace(/```[\s\S]*?```/g, '')
      // Убираем image references
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Убираем горизонтальные линии
      .replace(/^---+\s*$/gm, '')
      // Убираем blockquotes
      .replace(/^>\s+/gm, '')
      // Убираем список маркеры
      .replace(/^[*-]\s+/gm, '')
      // Убираем нумерованные списки
      .replace(/^\d+\.\s+/gm, '')
      // Множественные newline → одиночные
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 64)
  }
}
