import { LanguageAdapter, CodeBlock, languageRegistry } from './languageAdapter'

/**
 * Адаптер для YAML, JSON, TOML, INI — конфигурационные файлы
 * Извлекает логические секции по отступам и ключам верхнего уровня
 */
const yamlAdapter: LanguageAdapter = {
  extensions: ['yaml', 'yml', 'json', 'toml', 'ini', 'cfg', 'conf'],

  parse(code: string): string {
    return code
  },

  extractBlocks(code: string, originalCode: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const lines = originalCode.split('\n')
    let currentBlock: { name: string; lines: string[]; startLine: number } | null = null
    let blockIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Пропускаем пустые строки и комментарии
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        if (currentBlock) {
          currentBlock.lines.push(line)
        }
        continue
      }

      // YAML: ключ верхнего уровня (без отступа или с минимальным)
      const indent = line.search(/\S/)
      if (indent <= 1) {
        // Сохраняем предыдущий блок
        if (currentBlock && currentBlock.lines.length >= 2) {
          const code = currentBlock.lines.join('\n')
          blocks.push({
            id: `yaml-block-${blockIndex++}`,
            type: 'function',
            name: currentBlock.name,
            code,
            startLine: currentBlock.startLine,
            endLine: i - 1,
            complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 5)),
          })
        }
        // Начинаем новый блок
        const name = trimmed.split(':')[0] || trimmed.split('=')[0] || `section-${blockIndex}`
        currentBlock = { name, lines: [line], startLine: i }
      } else if (currentBlock) {
        currentBlock.lines.push(line)
      }
    }

    // Сохраняем последний блок
    if (currentBlock && currentBlock.lines.length >= 2) {
      const code = currentBlock.lines.join('\n')
      blocks.push({
        id: `yaml-block-${blockIndex++}`,
        type: 'function',
        name: currentBlock.name,
        code,
        startLine: currentBlock.startLine,
        endLine: lines.length - 1,
        complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 5)),
      })
    }

    return blocks
  },

  extractSignature(block: CodeBlock): string {
    return block.code.split('\n')[0] || ''
  },

  extractBody(block: CodeBlock): string {
    return block.code.split('\n').slice(1).join('\n')
  },
}

languageRegistry.register(yamlAdapter)
