import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

/**
 * Парсер для PDF файлов через pdfjs-dist.
 * Извлекает текст по страницам, каждая страница = глава.
 * Пытается определить заголовки по крупному шрифту.
 */
export class PdfParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const pdfjsLib = await import('pdfjs-dist')
    // Set worker source to a CDN to avoid bundling issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const name = file.name.replace(/\.[^/.]+$/, '')
    const bookId = crypto.randomUUID()

    const chapters: Chapter[] = []
    const textMap = new Map<string, string>()
    const allTextParts: string[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Build text from items, handling positions
      const items = textContent.items as Array<{
        str: string
        transform: number[]
        width: number
        height: number
      }>

      let pageText = ''
      let lastY: number | null = null

      for (const item of items) {
        const y = item.transform[5]
        // New line if Y position changed significantly
        if (lastY !== null && Math.abs(y - lastY) > item.height * 0.5) {
          pageText += '\n'
        } else if (lastY !== null && pageText.length > 0 && !pageText.endsWith('\n')) {
          pageText += ' '
        }
        pageText += item.str
        lastY = y
      }

      pageText = pageText.trim()
      if (!pageText) continue

      allTextParts.push(pageText)

      // Try to detect title from first non-empty line
      const firstLine = pageText.split('\n')[0].trim()
      const title = firstLine.length > 80
        ? `Страница ${pageNum}`
        : firstLine || `Страница ${pageNum}`

      const chId = `${bookId}-ch-${pageNum}`
      chapters.push({
        id: chId,
        title,
        level: 0,
        children: [],
      })
      textMap.set(chId, pageText)
    }

    // If no pages had text, create a single chapter
    if (chapters.length === 0) {
      const chId = `${bookId}-ch-main`
      chapters.push({
        id: chId,
        title: name,
        level: 0,
        children: [],
      })
      textMap.set(chId, '(Пустой PDF — текст не извлечён)')
    }

    const metadata: BookMetadata = {
      id: bookId,
      title: name,
      author: '',
      format: 'pdf',
      path: file.name,
      addedAt: Date.now(),
      totalChapters: chapters.length,
    }

    const allText = allTextParts.join('\n\n')

    return {
      metadata,
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return allText
      },
    }
  }
}
