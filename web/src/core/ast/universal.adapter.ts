import { LanguageAdapter, CodeBlock, languageRegistry } from './languageAdapter'

/**
 * Универсальный адаптер для файлов без специализированного парсера
 * Извлекает блоки по отступам, тегам, правилам и функциям
 * Поддерживает: HTML, CSS, SCSS, SQL, Shell, Lua, Dart, R и др.
 */
const universalAdapter: LanguageAdapter = {
  extensions: [
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'sql', 'sh', 'bash', 'zsh', 'fish',
    'lua', 'dart', 'r', 'm', 'pl', 'pm',
    'ex', 'exs', 'erl', 'hrl',
    'hs', 'lhs', 'ml', 'mli',
    'clj', 'cljs', 'edn',
    'tf', 'hcl', 'nix',
    'proto', 'graphql', 'gql',
    'prisma', 'env', 'gitignore', 'eslintignore', 'prettierignore',
  ],

  parse(code: string): string {
    return code
  },

  extractBlocks(code: string, originalCode: string, filePath?: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const lines = originalCode.split('\n')
    const ext = (filePath || originalCode).split('.').pop()?.toLowerCase() || ''

    // HTML-подобие: извлекаем по тегам/секциям
    if (['html', 'htm', 'xml', 'svg'].includes(ext)) {
      return extractByTags(originalCode)
    }

    // CSS-подобие: извлекаем по правилам
    if (['css', 'scss', 'sass', 'less'].includes(ext)) {
      return extractCssRules(originalCode)
    }

    // SQL: извлекаем по запросам
    if (ext === 'sql') {
      return extractSqlStatements(originalCode)
    }

    // Shell: извлекаем по функциям
    if (['sh', 'bash', 'zsh', 'fish'].includes(ext)) {
      return extractShellFunctions(originalCode)
    }

    // По умолчанию: извлекаем по отступам (секции верхнего уровня)
    return extractByIndentation(originalCode)
  },

  extractSignature(block: CodeBlock): string {
    return block.code.split('\n')[0] || ''
  },

  extractBody(block: CodeBlock): string {
    return block.code.split('\n').slice(1).join('\n')
  },
}

/**
 * Извлекает блоки по HTML-тегам
 */
function extractByTags(code: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const lines = code.split('\n')
  let currentBlock: { name: string; lines: string[]; startLine: number } | null = null
  let blockIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const openMatch = line.match(/<(\w[\w-]*)[^>]*>/)
    const closeMatch = line.match(/<\/(\w[\w-]*)>/)

    if (openMatch && !closeMatch) {
      if (currentBlock && currentBlock.lines.length >= 2) {
        blocks.push(createBlock(currentBlock, blockIndex++))
      }
      currentBlock = { name: `<${openMatch[1]}>`, lines: [line], startLine: i }
    } else if (currentBlock) {
      currentBlock.lines.push(line)
      if (closeMatch && closeMatch[1] === currentBlock.name.replace(/[<>]/g, '')) {
        blocks.push(createBlock(currentBlock, blockIndex++))
        currentBlock = null
      }
    }
  }

  if (currentBlock && currentBlock.lines.length >= 2) {
    blocks.push(createBlock(currentBlock, blockIndex++))
  }

  return blocks
}

/**
 * Извлекает CSS-правила
 */
function extractCssRules(code: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g
  let match
  let blockIndex = 0

  while ((match = ruleRegex.exec(code)) !== null) {
    const selector = match[1].trim()
    const body = match[2].trim()
    const fullCode = `${selector} {\n  ${body}\n}`
    const startLine = code.substring(0, match.index).split('\n').length

    if (body.split('\n').length >= 2) {
      blocks.push({
        id: `css-rule-${blockIndex++}`,
        type: 'function',
        name: selector.split('\n').pop()?.trim() || selector,
        code: fullCode,
        startLine,
        endLine: startLine + fullCode.split('\n').length,
        complexity: Math.min(10, Math.ceil(body.split(';').length / 2)),
      })
    }
  }

  return blocks
}

/**
 * Извлекает SQL-запросы
 */
function extractSqlStatements(code: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const lines = code.split('\n')
  let currentBlock: { lines: string[]; startLine: number } | null = null
  let blockIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('--')) {
      if (currentBlock) currentBlock.lines.push(lines[i])
      continue
    }

    const isStart = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(line)

    if (isStart) {
      if (currentBlock && currentBlock.lines.length >= 2) {
        const code = currentBlock.lines.join('\n')
        blocks.push({
          id: `sql-${blockIndex++}`,
          type: 'function',
          name: currentBlock.lines[0]?.trim().substring(0, 30) || `query-${blockIndex}`,
          code,
          startLine: currentBlock.startLine,
          endLine: i - 1,
          complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 4)),
        })
      }
      currentBlock = { lines: [lines[i]], startLine: i }
    } else if (currentBlock) {
      currentBlock.lines.push(lines[i])
    }
  }

  if (currentBlock && currentBlock.lines.length >= 2) {
    blocks.push({
      id: `sql-${blockIndex++}`,
      type: 'function',
      name: currentBlock.lines[0]?.trim().substring(0, 30) || `query-${blockIndex}`,
      code: currentBlock.lines.join('\n'),
      startLine: currentBlock.startLine,
      endLine: lines.length - 1,
      complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 4)),
    })
  }

  return blocks
}

/**
 * Извлекает shell-функции
 */
function extractShellFunctions(code: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const funcRegex = /^(\w+)\s*\(\)\s*\{/
  const lines = code.split('\n')
  let inFunction = false
  let currentBlock: { name: string; lines: string[]; startLine: number; braceCount: number } | null = null
  let blockIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!inFunction) {
      const match = line.match(funcRegex)
      if (match) {
        inFunction = true
        currentBlock = {
          name: match[1],
          lines: [line],
          startLine: i,
          braceCount: (line.match(/{/g) || []).length - (line.match(/}/g) || []).length,
        }
      }
    } else if (currentBlock) {
      currentBlock.lines.push(line)
      currentBlock.braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length

      if (currentBlock.braceCount <= 0) {
        blocks.push({
          id: `shell-func-${blockIndex++}`,
          type: 'function',
          name: currentBlock.name,
          code: currentBlock.lines.join('\n'),
          startLine: currentBlock.startLine,
          endLine: i,
          complexity: Math.min(10, Math.ceil(currentBlock.lines.length / 5)),
        })
        inFunction = false
        currentBlock = null
      }
    }
  }

  return blocks
}

/**
 * Извлекает блоки по отступам (универсальный fallback)
 */
function extractByIndentation(code: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const lines = code.split('\n')
  let currentBlock: { name: string; lines: string[]; startLine: number; indent: number } | null = null
  let blockIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      if (currentBlock) currentBlock.lines.push(line)
      continue
    }

    const indent = line.search(/\S/)

    if (indent === 0) {
      if (currentBlock && currentBlock.lines.length >= 3) {
        blocks.push(createUniversalBlock(currentBlock, blockIndex++))
      }
      currentBlock = {
        name: trimmed.replace(/\s*\{$/, '').substring(0, 40),
        lines: [line],
        startLine: i,
        indent: 0,
      }
    } else if (currentBlock) {
      currentBlock.lines.push(line)
    } else {
      currentBlock = {
        name: trimmed.replace(/\s*\{$/, '').substring(0, 40),
        lines: [line],
        startLine: i,
        indent,
      }
    }
  }

  if (currentBlock && currentBlock.lines.length >= 3) {
    blocks.push(createUniversalBlock(currentBlock, blockIndex++))
  }

  return blocks
}

function createBlock(block: { name: string; lines: string[]; startLine: number }, index: number): CodeBlock {
  const code = block.lines.join('\n')
  return {
    id: `html-block-${index}`,
    type: 'function',
    name: block.name,
    code,
    startLine: block.startLine,
    endLine: block.startLine + block.lines.length - 1,
    complexity: Math.min(10, Math.ceil(block.lines.length / 6)),
  }
}

function createUniversalBlock(block: { name: string; lines: string[]; startLine: number; indent: number }, index: number): CodeBlock {
  const code = block.lines.join('\n')
  return {
    id: `universal-block-${index}`,
    type: 'function',
    name: block.name,
    code,
    startLine: block.startLine,
    endLine: block.startLine + block.lines.length - 1,
    complexity: Math.min(10, Math.ceil(block.lines.length / 5)),
  }
}

languageRegistry.register(universalAdapter)
