import { LanguageAdapter, CodeBlock, languageRegistry } from './languageAdapter'

/**
 * Адаптер для Markdown файлов
 * Извлекает блоки кода из markdown (```code```)
 */
const markdownAdapter: LanguageAdapter = {
  extensions: ['md', 'mdx', 'markdown'],

  parse(code: string): string {
    return code
  },

  extractBlocks(code: string, originalCode: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const lines = originalCode.split('\n')
    let inCodeBlock = false
    let codeStart = 0
    let codeLines: string[] = []
    let lang = ''
    let blockIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(/^```(\w*)/)

      if (match && !inCodeBlock) {
        inCodeBlock = true
        codeStart = i + 1
        lang = match[1] || 'text'
        codeLines = []
      } else if (match && inCodeBlock) {
        inCodeBlock = false
        const code = codeLines.join('\n')
        if (code.trim().length > 0) {
          blocks.push({
            id: `md-block-${blockIndex++}`,
            type: 'function',
            name: `${lang} snippet`,
            code,
            startLine: codeStart,
            endLine: i,
            complexity: Math.min(10, Math.ceil(code.split('\n').length / 5)),
          })
        }
        codeLines = []
      } else if (inCodeBlock) {
        codeLines.push(line)
      }
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

languageRegistry.register(markdownAdapter)
