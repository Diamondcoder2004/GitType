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
    const blocks = adapter.extractBlocks(ast, code, filePath)
    
    console.log(`Extracted ${blocks.length} blocks from ${filePath}`)

    // Фильтрация блоков по критериям
    const filtered = blocks.filter((block) => {
      // Игнорируем слишком маленькие блоки (< 2 строк)
      const lineCount = block.endLine - block.startLine + 1
      if (lineCount < 2) {
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

/**
 * Извлекает импорты из исходного кода файла
 * Возвращает массив путей/модулей, на которые ссылается файл
 */
export function extractImports(code: string, filePath: string): string[] {
  const imports: string[] = []
  const dir = filePath.split('/').slice(0, -1).join('/')

  // ES6 import ... from '...'
  const esImportPattern = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g
  for (const match of code.matchAll(esImportPattern)) {
    imports.push(match[1])
  }

  // require('...')
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const match of code.matchAll(requirePattern)) {
    imports.push(match[1])
  }

  // Python: from ... import ... / import ...
  const pyFromImportPattern = /^from\s+(\S+)\s+import/gm
  for (const match of code.matchAll(pyFromImportPattern)) {
    imports.push(match[1])
  }
  const pyImportPattern = /^import\s+(\S+)/gm
  for (const match of code.matchAll(pyImportPattern)) {
    // Пропускаем уже найденные from ... import
    if (!match[0].startsWith('from')) {
      imports.push(match[1])
    }
  }

  // Резолвим относительные пути в абсолютные (внутри репозитория)
  return imports
    .filter(imp => imp.startsWith('.') || imp.startsWith('/'))
    .map(imp => {
      if (imp.startsWith('.')) {
        // Склеиваем директорию файла + относительный путь
        const parts = dir.split('/')
        const impParts = imp.split('/')
        for (const part of impParts) {
          if (part === '.') continue
          else if (part === '..') parts.pop()
          else parts.push(part)
        }
        return parts.join('/')
      }
      return imp
    })
}

/**
 * Структура иерархического дерева блоков
 */
export interface BlockTreeNode {
  block: CodeBlock
  children: BlockTreeNode[]
}

/**
 * Строит иерархическое дерево блоков (класс → методы)
 */
export function buildBlockTree(blocks: CodeBlock[]): BlockTreeNode[] {
  const rootBlocks = blocks.filter(b => !b.parentId)
  const childrenMap = new Map<string, CodeBlock[]>()

  for (const block of blocks) {
    if (block.parentId) {
      const existing = childrenMap.get(block.parentId) || []
      existing.push(block)
      childrenMap.set(block.parentId, existing)
    }
  }

  const buildNode = (block: CodeBlock): BlockTreeNode => {
    const children = (childrenMap.get(block.id) || [])
      .sort((a, b) => a.startLine - b.startLine)
      .map(buildNode)
    return { block, children }
  }

  return rootBlocks
    .sort((a, b) => a.startLine - b.startLine)
    .map(buildNode)
}
