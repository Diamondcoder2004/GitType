import { LanguageAdapter, CodeBlock, languageRegistry } from './languageAdapter'

/**
 * Адаптер для Vue SFC (.vue файлов)
 * Извлекает <template>, <script>, <style> блоки
 */
const vueAdapter: LanguageAdapter = {
  extensions: ['vue', 'svelte', 'astro'],

  parse(code: string): string {
    return code
  },

  extractBlocks(code: string, originalCode: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const sectionRegex = /<(template|script|style)([^>]*)>([\s\S]*?)<\/\1>/gi
    let match
    let blockIndex = 0

    while ((match = sectionRegex.exec(originalCode)) !== null) {
      const sectionType = match[1]
      const attrs = match[2]
      const content = match[3].trim()

      if (content.length > 0) {
        const startLine = originalCode.substring(0, match.index).split('\n').length + 1
        const endLine = startLine + match[0].split('\n').length - 1
        const lang = attrs.match(/lang="(\w+)"/)?.[1] || sectionType

        blocks.push({
          id: `vue-block-${blockIndex++}`,
          type: 'function',
          name: `<${sectionType}${lang !== sectionType ? ` lang="${lang}"` : ''}>`,
          code: content,
          startLine,
          endLine,
          complexity: Math.min(10, Math.ceil(content.split('\n').length / 8)),
        })
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

languageRegistry.register(vueAdapter)
