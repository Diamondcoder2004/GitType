/**
 * Представляет извлечённый из AST блок кода
 */
export interface CodeBlock {
  id: string
  type: 'function' | 'class' | 'method' | 'interface' | 'type'
  name: string
  code: string
  startLine: number
  endLine: number
  complexity: number
  signature?: string
  body?: string
  /** ID родительского блока (например, класс для метода) */
  parentId?: string
}

/**
 * Интерфейс языкового адаптера для парсинга AST
 */
export interface LanguageAdapter {
  /**
   * Поддерживаемые расширения файлов
   */
  extensions: string[]

  /**
   * Парсит код и возвращает AST (или промежуточное представление)
   */
  parse(code: string): unknown

  /**
   * Извлекает семантические блоки из AST
   */
  extractBlocks(ast: unknown, code: string, filePath?: string): CodeBlock[]

  /**
   * Извлекает сигнатуру из блока (например, объявление функции)
   */
  extractSignature(block: CodeBlock): string

  /**
   * Извлекает тело из блока (без сигнатуры)
   */
  extractBody(block: CodeBlock): string
}

/**
 * Реестр языковых адаптеров
 */
export class LanguageAdapterRegistry {
  private adapters: Map<string, LanguageAdapter> = new Map()
  private fileMatchers: Array<{ pattern: RegExp | string; adapter: LanguageAdapter }> = []

  register(adapter: LanguageAdapter): void {
    for (const ext of adapter.extensions) {
      // Если расширение содержит точку или выглядит как имя файла — это file matcher
      if (ext.includes('.') || ext.toLowerCase() === ext) {
        this.adapters.set(ext.toLowerCase(), adapter)
      }
    }
  }

  registerFileMatcher(pattern: RegExp | string, adapter: LanguageAdapter): void {
    this.fileMatchers.push({ pattern, adapter })
  }

  getAdapter(extension: string, fileName?: string): LanguageAdapter | null {
    // Сначала проверяем file matchers (для Dockerfile, Makefile и т.д.)
    if (fileName) {
      const lowerName = fileName.toLowerCase()
      for (const { pattern, adapter } of this.fileMatchers) {
        if (pattern instanceof RegExp && pattern.test(lowerName)) return adapter
        if (typeof pattern === 'string' && lowerName === pattern) return adapter
      }
    }
    return this.adapters.get(extension.toLowerCase()) || null
  }

  isSupported(extension: string): boolean {
    return this.adapters.has(extension.toLowerCase())
  }
}

export const languageRegistry = new LanguageAdapterRegistry()
