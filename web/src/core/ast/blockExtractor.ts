import { CodeBlock, LanguageAdapter } from './languageAdapter'
import { languageRegistry } from './languageAdapter'
import './typescript.adapter'
import './python.adapter'
import './markdown.adapter'
import './yaml.adapter'
import './dockerfile.adapter'
import './vue.adapter'
import './universal.adapter'

/**
 * Извлекает семантические блоки кода из файла
 * Pure function - без побочных эффектов
 */
export function extractCodeBlocks(
  code: string,
  filePath: string
): CodeBlock[] {
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1] || ''
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : ''
  const adapter = languageRegistry.getAdapter(extension, fileName)

  if (!adapter) {
    console.log(`No adapter for extension: ${extension}`)
    return []
  }

  try {
    const ast = adapter.parse(code)
    const blocks = adapter.extractBlocks(ast, code)
    
    console.log(`Extracted ${blocks.length} blocks from ${filePath}`)

    // Фильтрация блоков по критериям
    const filtered = blocks.filter((block) => {
      // Игнорируем слишком маленькие блоки (< 3 строк)
      const lineCount = block.endLine - block.startLine + 1
      if (lineCount < 3) {
        console.log(`Skipping block ${block.name}: too small (${lineCount} lines)`)
        return false
      }

      // Игнорируем слишком большие блоки (> 80 строк)
      if (lineCount > 80) {
        console.log(`Skipping block ${block.name}: too large (${lineCount} lines)`)
        return false
      }

      return true
    })
    
    console.log(`Filtered to ${filtered.length} blocks`)
    return filtered
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
