import { CodeBlock, LanguageAdapter } from './languageAdapter'
import { languageRegistry } from './languageAdapter'

/**
 * Извлекает семантические блоки кода из файла
 * Pure function - без побочных эффектов
 */
export function extractCodeBlocks(
  code: string,
  filePath: string
): CodeBlock[] {
  const extension = filePath.split('.').pop()?.toLowerCase() || ''
  const adapter = languageRegistry.getAdapter(extension)

  if (!adapter) {
    return []
  }

  try {
    const ast = adapter.parse(code)
    const blocks = adapter.extractBlocks(ast, code)

    // Фильтрация блоков по критериям
    return blocks.filter((block) => {
      // Игнорируем слишком маленькие блоки (< 5 строк)
      const lineCount = block.endLine - block.startLine + 1
      if (lineCount < 5) return false

      // Игнорируем слишком большие блоки (> 60 строк)
      if (lineCount > 60) return false

      return true
    })
  } catch (error) {
    console.error(`Error extracting blocks from ${filePath}:`, error)
    return []
  }
}

/**
 * Выбирает случайный блок из списка
 */
export function getRandomBlock(blocks: CodeBlock[]): CodeBlock | null {
  if (blocks.length === 0) return null
  return blocks[Math.floor(Math.random() * blocks.length)]
}

/**
 * Подготавливает блок для режима "Implement"
 * Оставляет сигнатуру, заменяет тело на заглушку
 */
export function prepareImplementMode(
  block: CodeBlock,
  adapter: LanguageAdapter
): { signature: string; body: string; placeholder: string } {
  const signature = adapter.extractSignature(block)
  const body = adapter.extractBody(block)

  const placeholder = `${signature}
  // TODO: Implement this function
}`

  return { signature, body, placeholder }
}
