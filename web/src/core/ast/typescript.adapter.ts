import { CodeBlock, LanguageAdapter } from './languageAdapter'
import { languageRegistry } from './languageAdapter'

/**
 * Адаптер для TypeScript/JavaScript
 * Использует регулярные выражения для извлечения блоков
 * (в production версии следует использовать tree-sitter)
 */
class TypeScriptAdapter implements LanguageAdapter {
  extensions = ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts']

  parse(code: string): unknown {
    // В полной версии здесь был бы вызов tree-sitter
    // Для MVP возвращаем сырой код
    return { code }
  }

  extractBlocks(_ast: unknown, code: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const lines = code.split('\n')

    // Паттерны для извлечения функций и классов
    const functionPattern =
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+(?:<[^>]+>)?)?\s*\{/m
    const classPattern = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m
    const arrowFunctionPattern =
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*\w+(?:<[^>]+>)?)?\s*=>/m

    let idCounter = 0

    // Поиск функций
    for (const match of code.matchAll(functionPattern)) {
      const name = match[1]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      const { endIndex, endLine } = this.findBlockEnd(lines, startLine)
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

    // Поиск классов
    for (const match of code.matchAll(classPattern)) {
      const name = match[1]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      const { endIndex, endLine } = this.findBlockEnd(lines, startLine)
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

    // Поиск стрелочных функций
    for (const match of code.matchAll(arrowFunctionPattern)) {
      const name = match[1]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      // Для стрелочных функций ищем конец по фигурным скобкам или точке с запятой
      let endIndex = startIndex
      let endLine = startLine

      if (code.substring(startIndex).includes('{')) {
        const { endIndex: foundEndIndex, endLine: foundEndLine } =
          this.findBlockEnd(lines, startLine)
        endIndex = foundEndIndex
        endLine = foundEndLine
      } else {
        // Однострочная стрелочная функция
        endIndex = startIndex + code.substring(startIndex).indexOf(';') + 1
        endLine = startLine
      }

      const blockCode = code.substring(startIndex, endIndex)

      if (this.isValidBlock(blockCode, startLine, endLine)) {
        blocks.push({
          id: `arrow-${idCounter++}`,
          type: 'function',
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
    startLine: number
  ): { endIndex: number; endLine: number } {
    let braceCount = 0
    let started = false
    let endIndex = 0
    let currentLine = startLine

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i]
      currentLine = i + 1

      for (const char of line) {
        if (char === '{') {
          braceCount++
          started = true
        } else if (char === '}') {
          braceCount--
        }
      }

      if (started && braceCount === 0) {
        endIndex = lines.slice(0, i + 1).join('\n').length + 1
        return { endIndex, endLine: currentLine }
      }
    }

    // Если не нашли закрывающую скобку, возвращаем конец файла
    endIndex = lines.join('\n').length
    return { endIndex, endLine: lines.length }
  }

  private isValidBlock(
    _code: string,
    startLine: number,
    endLine: number
  ): boolean {
    const lineCount = endLine - startLine + 1
    // Игнорируем слишком маленькие (< 5 строк) и слишком большие (> 60 строк) блоки
    return lineCount >= 5 && lineCount <= 60
  }

  extractSignature(block: CodeBlock): string {
    const lines = block.code.split('\n')
    const signatureEnd = this.findSignatureEnd(lines)
    return lines.slice(0, signatureEnd + 1).join('\n')
  }

  extractBody(block: CodeBlock): string {
    const lines = block.code.split('\n')
    const signatureEnd = this.findSignatureEnd(lines)
    const bodyLines = lines.slice(signatureEnd + 1)

    // Удаляем последнюю закрывающую скобку
    if (bodyLines.length > 0) {
      const lastLine = bodyLines[bodyLines.length - 1].trim()
      if (lastLine === '}') {
        bodyLines.pop()
      }
    }

    return bodyLines.join('\n')
  }

  private findSignatureEnd(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('{')) {
        return i
      }
    }
    return 0
  }

  private calculateComplexity(code: string): number {
    let complexity = 0

    // +1 за каждое условие/цикл
    const patterns = [/\bif\b/g, /\bfor\b/g, /\bwhile\b/g, /\bswitch\b/g, /\bcatch\b/g, /\?\./g, /&&/g, /\|\|/g]

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
      const openBraces = (line.match(/{/g) || []).length
      const closeBraces = (line.match(/}/g) || []).length

      currentDepth += openBraces
      maxDepth = Math.max(maxDepth, currentDepth)
      currentDepth -= closeBraces
    }

    if (maxDepth > 2) {
      complexity += 2
    }

    return complexity
  }
}

// Регистрируем адаптер
languageRegistry.register(new TypeScriptAdapter())

export { TypeScriptAdapter }
