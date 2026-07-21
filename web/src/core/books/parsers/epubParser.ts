import type { BookParser, BookMetadata, Chapter, ParsedBook } from '../types'

/**
 * Простой EPUB парсер.
 * Распаковывает ZIP, читает OPF манифест, извлекает главы из XHTML.
 * Для v1 — минимальная реализация: только текст, без стилей и картинок.
 */
export class EpubParser implements BookParser {
  async parse(file: File): Promise<ParsedBook> {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)

    // Ищем OPF файл (container.xml → rootfile)
    const containerXml = await this.readEntry(zip, 'META-INF/container.xml')
    if (!containerXml) throw new Error('EPUB: container.xml not found')

    const opfPath = this.extractOpfPath(containerXml)
    if (!opfPath) throw new Error('EPUB: OPF path not found')

    const opfXml = await this.readEntry(zip, opfPath)
    if (!opfXml) throw new Error('EPUB: OPF file not found')

    const baseDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)
    const metadata = this.extractMetadata(opfXml, file.name, baseDir, file)

    // Извлекаем список XHTML файлов (главы) из OPF
    const spineItems = this.extractSpineItems(opfXml, baseDir)
    const chapters: Chapter[] = []
    const textMap = new Map<string, string>()

    for (let i = 0; i < spineItems.length; i++) {
      const item = spineItems[i]
      const chapterId = `${metadata.id}-ch-${i}`
      let html = await this.readEntry(zip, item.path)

      if (!html) {
        // Пробуем без baseDir
        html = await this.readEntry(zip, item.path.replace(baseDir, ''))
      }

      const cleanText = html ? this.extractTextFromHtml(html) : ''
      const title = item.title || `Chapter ${i + 1}`

      chapters.push({
        id: chapterId,
        title,
        level: 0,
        children: [],
      })
      textMap.set(chapterId, cleanText)
    }

    // Если нет глав из spine — пробуем найти все XHTML/HTML файлы
    if (chapters.length === 0) {
      const htmlFiles = Object.keys(zip.files).filter(
        f => f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm')
      ).sort()

      for (let i = 0; i < htmlFiles.length; i++) {
        const chapterId = `${metadata.id}-ch-${i}`
        const html = await this.readEntry(zip, htmlFiles[i])
        const cleanText = html ? this.extractTextFromHtml(html) : ''

        chapters.push({
          id: chapterId,
          title: htmlFiles[i].split('/').pop()?.replace(/\.[^/.]+$/, '') || `Chapter ${i + 1}`,
          level: 0,
          children: [],
        })
        textMap.set(chapterId, cleanText)
      }
    }

    return {
      metadata: { ...metadata, totalChapters: chapters.length },
      chapters,
      getText(chapterId: string): string {
        return textMap.get(chapterId) || ''
      },
      getAllText(): string {
        return Array.from(textMap.values()).join('\n\n')
      },
    }
  }

  private async readEntry(zip: any, path: string): Promise<string | null> {
    const entry = zip.files[path]
    if (!entry || entry.dir) return null
    try {
      const content = await entry.async('text')
      // EPUB файлы обычно в UTF-8, но могут быть и в других кодировках
      // Для v1 — считаем что UTF-8
      return content
    } catch {
      return null
    }
  }

  private extractOpfPath(containerXml: string): string | null {
    const match = containerXml.match(/rootfile[^>]*full-path="([^"]+)"/i)
    return match ? match[1] : null
  }

  private extractMetadata(
    opfXml: string,
    fileName: string,
    _baseDir: string,
    file: File
  ): Omit<BookMetadata, 'totalChapters'> {
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)
    const title = titleMatch ? this.decodeXml(titleMatch[1]) : fileName.replace(/\.[^/.]+$/, '')
    const author = authorMatch ? this.decodeXml(authorMatch[1]) : ''

    return {
      id: crypto.randomUUID(),
      title,
      author,
      format: 'epub',
      path: fileName,
      addedAt: Date.now(),
    }
  }

  private extractSpineItems(opfXml: string, baseDir: string): Array<{ path: string; title: string }> {
    const items: Array<{ path: string; title: string }> = []
    const itemRefs: string[] = []

    // Извлекаем idrefs из spine
    const spineMatches = opfXml.matchAll(/<itemref[^>]*idref="([^"]+)"/gi)
    for (const match of spineMatches) {
      itemRefs.push(match[1])
    }

    // Извлекаем manifest items
    const itemMatches = opfXml.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="application\/xhtml\+xml"[^>]*\/?>/gi)
    const itemMap = new Map<string, string>()
    for (const match of itemMatches) {
      itemMap.set(match[1], match[2])
    }

    // Собираем spine
    for (const ref of itemRefs) {
      const href = itemMap.get(ref)
      if (href) {
        items.push({
          path: baseDir + href,
          title: ref,
        })
      }
    }

    return items
  }

  private extractTextFromHtml(html: string): string {
    // Убираем <script> и <style> блоки
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Убираем все HTML теги
    text = text.replace(/<[^>]+>/g, '')
    // Декодируем HTML entities
    text = text.replace(/&nbsp;/g, ' ')
    text = text.replace(/&amp;/g, '&')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&#39;/g, "'")
    text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // Множественные пробелы → один
    text = text.replace(/[ \t]+/g, ' ')
    // Множественные newline → двойные
    text = text.replace(/\n{3,}/g, '\n\n')
    return text.trim()
  }

  private decodeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }
}
