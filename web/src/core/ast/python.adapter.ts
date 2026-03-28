import { CodeBlock, LanguageAdapter } from './languageAdapter'
import { languageRegistry } from './languageAdapter'

/**
 * Адаптер для Python
 * Использует регулярные выражения для извлечения блоков
 * (в production версии следует использовать tree-sitter)
 */
class PythonAdapter implements LanguageAdapter {
  extensions = ['py', 'pyw', 'pyi']

  parse(code: string): unknown {
    // В полной версии здесь был бы вызов tree-sitter
    // Для MVP возвращаем сырой код
    return { code }
  }

  extractBlocks(_ast: unknown, code: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const lines = code.split('\n')

    // Паттерны для извлечения функций и классов
    const functionPattern = /^(\s*)def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*\w+)?\s*:/m
    const classPattern = /^(\s*)class\s+(\w+)(?:\s*\([^)]*\))?\s*:/m
    const asyncFunctionPattern = /^(\s*)async\s+def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*\w+)?\s*:/m

    let idCounter = 0

    // Поиск функций
    for (const match of code.matchAll(functionPattern)) {
      // Пропускаем методы внутри классов (они имеют отступ)
      const indent = match[1]
      if (indent.length > 0) continue

      const name = match[2]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      const { endIndex, endLine } = this.findBlockEnd(lines, startLine, indent.length)
      const blockCode = code.substring(startIndex, endIndex)

      if (this.isValidBlock(blockCode, startLine, endLine)) {
        blocks.push({
          id: `fn-${idCounter++}`,
          type: 'function',
          name,
          code: blockCode,
          startLine,
          endLine,
          complexity: this.calculateComplexity(blockCode),
        })
      }
    }

    // Поиск async функций
    for (const match of code.matchAll(asyncFunctionPattern)) {
      const indent = match[1]
      if (indent.length > 0) continue

      const name = match[2]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      const { endIndex, endLine } = this.findBlockEnd(lines, startLine, indent.length)
      const blockCode = code.substring(startIndex, endIndex)

      if (this.isValidBlock(blockCode, startLine, endLine)) {
        blocks.push({
          id: `async-fn-${idCounter++}`,
          type: 'function',
          name,
          code: blockCode,
          startLine,
          endLine,
          complexity: this.calculateComplexity(blockCode),
        })
      }
    }

    // Поиск классов
    for (const match of code.matchAll(classPattern)) {
      const indent = match[1]
      if (indent.length > 0) continue

      const name = match[2]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      const { endIndex, endLine } = this.findBlockEnd(lines, startLine, indent.length)
      const blockCode = code.substring(startIndex, endIndex)

      if (this.isValidBlock(blockCode, startLine, endLine)) {
        blocks.push({
          id: `class-${idCounter++}`,
          type: 'class',
          name,
          code: blockCode,
          startLine,
          endLine,
          complexity: this.calculateComplexity(blockCode),
        })
      }
    }

    return blocks
  }

  private findBlockEnd(
    lines: string[],
    startLine: number,
    baseIndent: number
  ): { endIndex: number; endLine: number } {
    let endIndex = 0
    let endLine = startLine
    let foundContent = false

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i]
      const currentIndent = this.getIndent(line)

      // Пропускаем пустые строки в начале
      if (!foundContent && line.trim() === '') {
        continue
      }

      foundContent = true

      // Если нашли строку с меньшим или равным базовому отступу (и не пустая)
      if (line.trim() !== '' && currentIndent <= baseIndent && i > startLine) {
        endIndex = lines.slice(0, i).join('\n').length
        endLine = i
        return { endIndex, endLine }
      }

      endLine = i + 1
    }

    // Если не нашли конец, возвращаем конец файла
    endIndex = lines.join('\n').length
    return { endIndex, endLine }
  }

  private getIndent(line: string): number {
    const match = line.match(/^(\s*)/)
    return match ? match[1].length : 0
  }

  private isValidBlock(
    code: string,
    startLine: number,
    endLine: number
  ): boolean {
    const lineCount = endLine - startLine + 1
    // Игнорируем слишком маленькие (< 5 строк) и слишком большие (> 60 строк) блоки
    return lineCount >= 5 && lineCount <= 60
  }

  extractSignature(block: CodeBlock): string {
    const lines = block.code.split('\n')
    // Сигнатура - это первая строка (def или class)
    return lines[0] || ''
  }

  extractBody(block: CodeBlock): string {
    const lines = block.code.split('\n')
    // Тело - это всё кроме первой строки и без последнего отступа
    const bodyLines = lines.slice(1)

    // Удаляем pass или ... если это заглушка
    if (bodyLines.length > 0) {
      const firstBodyLine = bodyLines[0].trim()
      if (firstBodyLine === 'pass' || firstBodyLine === '...' || firstBodyLine === '"""' || firstBodyLine.startsWith('"""')) {
        // Оставляем тело пустым для implement mode
        return bodyLines.join('\n')
      }
    }

    return bodyLines.join('\n')
  }

  private calculateComplexity(code: string): number {
    let complexity = 0

    // +1 за каждое условие/цикл
    const patterns = [
      /\bif\b/g,
      /\belif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bexcept\b/g,
      /\band\b/g,
      /\bor\b/g,
      /\bwith\b/g,
    ]

    for (const pattern of patterns) {
      const matches = code.match(pattern)
      if (matches) {
        complexity += matches.length
      }
    }

    // +2 за глубину вложенности > 2
    const lines = code.split('\n')
    let maxDepth = 0
    let currentDepth = 0

    for (const line of lines) {
      const stripped = line.trim()
      if (!stripped || stripped.startsWith('#')) continue

      const indent = this.getIndent(line)
      // Считаем глубину как indent / 4 (стандартный отступ в Python)
      const depth = Math.floor(indent / 4)
      maxDepth = Math.max(maxDepth, depth)
    }

    if (maxDepth > 2) {
      complexity += 2
    }

    return complexity
  }
}

// Регистрируем адаптер
languageRegistry.register(new PythonAdapter())

export { PythonAdapter }
