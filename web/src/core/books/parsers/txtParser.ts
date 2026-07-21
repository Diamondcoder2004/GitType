import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

/**
 * Парсер для .txt файлов.
 * Вся книга — одна глава. Название = имя файла без расширения.
 */
export class TxtParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const text = await file.text()
    const name = file.name.replace(/\.[^/.]+$/, '')
    const bookId = crypto.randomUUID()

    const metadata: BookMetadata = {
      id: bookId,
      title: name,
      author: '',
      format: 'txt',
      path: file.name,
      addedAt: Date.now(),
      totalChapters: 1,
    }

    const chapters: Chapter[] = [
      {
        id: `${bookId}-ch-main`,
        title: name,
        level: 0,
        children: [],
      },
    ]

    const textMap = new Map<string, string>()
    textMap.set(`${bookId}-ch-main`, text)

    return {
      metadata,
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return text
      },
    }
  }
}
