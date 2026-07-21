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

    // Обновленные паттерны с поддержкой отступов (^\s*) и export default
    const functionPattern = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*\(/gm
    const classPattern = /^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/gm
    const arrowFunctionPattern = /^\s*(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/gm
    // Паттерн для методов класса или объекта (исключая if, for, while, catch, switch)
    const methodPattern = /^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?(?!(?:if|for|while|catch|switch)\b)(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?::\s*[^{=]+)?\s*\{/gm

    let idCounter = 0

    // Вспомогательная функция для добавления блоков
    const addBlocks = (matches: IterableIterator<RegExpMatchArray>, type: string) => {
      for (const match of matches) {
        const name = match[1]
        if (!name) continue
        
        const startIndex = match.index!
        // Считаем строки до начала совпадения
        const startLine = code.substring(0, startIndex).split('\n').length

        // Ищем конец блока
        const { endIndex, endLine } = this.findBlockEnd(lines, startLine)
        
        // Если блок не найден корректно, пропускаем
        if (endIndex <= startIndex) continue

        const blockCode = code.substring(startIndex, endIndex)

        if (this.isValidBlock(blockCode, startLine, endLine)) {
          blocks.push({
            id: `${type}-${idCounter++}`,
            type: type as 'function' | 'class' | 'method' | 'interface' | 'type',
            name,
            code: blockCode,
            startLine,
            endLine,
            complexity: this.calculateComplexity(blockCode),
          })
        }
      }
    }

    addBlocks(code.matchAll(functionPattern), 'function')
    addBlocks(code.matchAll(classPattern), 'class')
    addBlocks(code.matchAll(methodPattern), 'method')

    // Поиск стрелочных функций (немного другая логика, так как могут быть без {})
    for (const match of code.matchAll(arrowFunctionPattern)) {
      const name = match[1]
      const startIndex = match.index!
      const startLine = code.substring(0, startIndex).split('\n').length

      let endIndex = startIndex
      let endLine = startLine

      // Проверяем, есть ли блок с фигурными скобками
      // Ищем '=>' и проверяем первый непустой символ после него
      const afterMatch = code.substring(startIndex + match[0].length)
      const isBlockBody = afterMatch.trim().startsWith('{')

      if (isBlockBody) {
        const { endIndex: foundEndIndex, endLine: foundEndLine } = this.findBlockEnd(lines, startLine)
        endIndex = foundEndIndex
        endLine = foundEndLine
      } else {
        // Однострочная стрелочная функция
        const semicolonIndex = code.substring(startIndex).indexOf(';')
        if (semicolonIndex !== -1) {
          endIndex = startIndex + semicolonIndex + 1
        } else {
          // Ищем конец строки, если нет точки с запятой
          const nlIndex = code.substring(startIndex).indexOf('\n')
          endIndex = nlIndex !== -1 ? startIndex + nlIndex : code.length
        }
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

    // Дедупликация: если один блок совпадает по startLine с другим, оставляем более специфичный
    const seen = new Map<number, CodeBlock>()
    for (const block of blocks) {
      const existing = seen.get(block.startLine)
      if (!existing) {
        seen.set(block.startLine, block)
      } else {
        // method > function > class (более специфичный тип выигрывает)
        const priority: Record<string, number> = { method: 3, function: 2, class: 1 }
        if ((priority[block.type] || 0) > (priority[existing.type] || 0)) {
          seen.set(block.startLine, block)
        }
      }
    }
    const uniqueBlocks = Array.from(seen.values())

    // Привязка методов к родительским классам
    const classBlocks = uniqueBlocks.filter(b => b.type === 'class')
    for (const block of uniqueBlocks) {
      if (block.type === 'method' || (block.type === 'function' && block.id.startsWith('arrow-'))) {
        for (const cls of classBlocks) {
          if (block.startLine > cls.startLine && block.endLine <= cls.endLine) {
            block.parentId = cls.id
            break
          }
        }
      }
    }

    return uniqueBlocks
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
    // Игнорируем слишком маленькие (< 3 строк) и слишком большие (> 80 строк) блоки
    return lineCount >= 3 && lineCount <= 80
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
