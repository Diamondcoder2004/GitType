import { LanguageAdapter, CodeBlock, languageRegistry } from './languageAdapter'

/**
 * Адаптер для Dockerfile
 * Извлекает логические секции: FROM, RUN, COPY/ADD, и группы команд
 */
const dockerfileAdapter: LanguageAdapter = {
  extensions: ['dockerfile', 'dockerignore', 'containerfile'],

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

      // Пропускаем комментарии и пустые строки
      if (!trimmed || trimmed.startsWith('#')) {
        if (currentBlock) currentBlock.lines.push(line)
        continue
      }

      // Новая инструкция Dockerfile (FROM, RUN, COPY, ADD, ENV, EXPOSE, CMD, ENTRYPOINT, WORKDIR, ARG)
      const instruction = trimmed.split(/\s/)[0]?.toUpperCase()
      const isMajorInstruction = ['FROM', 'RUN', 'COPY', 'ADD', 'CMD', 'ENTRYPOINT'].includes(instruction)

      if (isMajorInstruction) {
        // Сохраняем предыдущий блок
        if (currentBlock && currentBlock.lines.length >= 1) {
          const code = currentBlock.lines.join('\n')
          blocks.push({
            id: `docker-block-${blockIndex++}`,
            type: 'function',
            name: currentBlock.name,
            code,
            startLine: currentBlock.startLine,
            endLine: i - 1,
            complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 3)),
          })
        }
        // Новый блок
        const name = instruction === 'FROM' ? `Base: ${trimmed.split(' ')[1] || 'image'}` : instruction
        currentBlock = { name, lines: [line], startLine: i }
      } else if (currentBlock) {
        // Продолжение предыдущей инструкции (через \) или связанная команда
        const prevLine = currentBlock.lines[currentBlock.lines.length - 1]?.trim()
        if (prevLine?.endsWith('\\')) {
          currentBlock.lines.push(line)
        } else {
          // Новая связанная группа
          if (currentBlock.lines.length >= 1) {
            const code = currentBlock.lines.join('\n')
            blocks.push({
              id: `docker-block-${blockIndex++}`,
              type: 'function',
              name: currentBlock.name,
              code,
              startLine: currentBlock.startLine,
              endLine: i - 1,
              complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 3)),
            })
          }
          currentBlock = { name: instruction || `step-${blockIndex}`, lines: [line], startLine: i }
        }
      } else {
        currentBlock = { name: instruction || `step-${blockIndex}`, lines: [line], startLine: i }
      }
    }

    // Сохраняем последний блок
    if (currentBlock && currentBlock.lines.length >= 1) {
      blocks.push({
        id: `docker-block-${blockIndex++}`,
        type: 'function',
        name: currentBlock.name,
        code: currentBlock.lines.join('\n'),
        startLine: currentBlock.startLine,
        endLine: lines.length - 1,
        complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 3)),
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

languageRegistry.register(dockerfileAdapter)

// Регистрируем file matcher для файлов без расширения
languageRegistry.registerFileMatcher(/^dockerfile/i, dockerfileAdapter)
languageRegistry.registerFileMatcher(/^containerfile/i, dockerfileAdapter)
