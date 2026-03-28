import { CodeBlock } from './languageAdapter'

/**
 * Вычисляет цикломатическую сложность блока кода
 * Pure function
 */
export function calculateComplexity(code: string): number {
  let complexity = 0

  // +1 за каждое условие/цикл
  const branchingPatterns = [
    /\bif\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcatch\b/g,
    /\?\./g, // optional chaining
    /&&/g,
    /\|\|/g,
  ]

  for (const pattern of branchingPatterns) {
    const matches = code.match(pattern)
    if (matches) {
      complexity += matches.length
    }
  }

  // +2 за глубину вложенности > 2
  const depthBonus = calculateDepthBonus(code)
  complexity += depthBonus

  return complexity
}

/**
 * Вычисляет дополнительный балл за глубину вложенности
 */
export function calculateDepthBonus(code: string): number {
  const lines = code.split('\n')
  let maxDepth = 0
  let currentDepth = 0

  for (const line of lines) {
    // Считаем открывающие скобки
    const openBraces = (line.match(/{/g) || []).length
    const closeBraces = (line.match(/}/g) || []).length

    currentDepth += openBraces
    maxDepth = Math.max(maxDepth, currentDepth)
    currentDepth -= closeBraces
  }

  // +2 если глубина > 2
  return maxDepth > 2 ? 2 : 0
}

/**
 * Сортирует блоки по сложности
 */
export function sortBlocksByComplexity(
  blocks: CodeBlock[],
  order: 'asc' | 'desc' = 'asc'
): CodeBlock[] {
  return [...blocks].sort((a, b) => {
    return order === 'asc' ? a.complexity - b.complexity : b.complexity - a.complexity
  })
}

/**
 * Фильтрует блоки по диапазону сложности
 */
export function filterBlocksByComplexity(
  blocks: CodeBlock[],
  min: number,
  max: number
): CodeBlock[] {
  return blocks.filter((block) => block.complexity >= min && block.complexity <= max)
}
