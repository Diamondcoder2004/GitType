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
  extractBlocks(ast: unknown, code: string): CodeBlock[]

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

  register(adapter: LanguageAdapter): void {
    for (const ext of adapter.extensions) {
      this.adapters.set(ext, adapter)
    }
  }

  getAdapter(extension: string): LanguageAdapter | null {
    return this.adapters.get(extension.toLowerCase()) || null
  }

  isSupported(extension: string): boolean {
    return this.adapters.has(extension.toLowerCase())
  }
}

export const languageRegistry = new LanguageAdapterRegistry()
