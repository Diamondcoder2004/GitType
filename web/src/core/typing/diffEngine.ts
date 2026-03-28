export interface DiffResult {
  type: 'equal' | 'insert' | 'delete' | 'replace'
  value: string
  position?: number
}

/**
 * Минимальная реализация diff для сравнения текста
 * Pure function
 */
export function computeDiff(original: string, typed: string): DiffResult[] {
  const results: DiffResult[] = []

  const maxLen = Math.max(original.length, typed.length)

  for (let i = 0; i < maxLen; i++) {
    const origChar = original[i]
    const typedChar = typed[i]

    if (origChar === undefined) {
      results.push({ type: 'insert', value: typedChar, position: i })
    } else if (typedChar === undefined) {
      results.push({ type: 'delete', value: origChar, position: i })
    } else if (origChar === typedChar) {
      results.push({ type: 'equal', value: origChar, position: i })
    } else {
      results.push({ type: 'replace', value: `${origChar}→${typedChar}`, position: i })
    }
  }

  return results
}

/**
 * Сравнивает два текста с учётом режима
 */
export function compareText(
  original: string,
  typed: string,
  ignoreWhitespace: boolean = false
): { isMatch: boolean; mismatchCount: number } {
  if (ignoreWhitespace) {
    const origNormalized = original.replace(/\s+/g, ' ').trim()
    const typedNormalized = typed.replace(/\s+/g, ' ').trim()
    return {
      isMatch: origNormalized === typedNormalized,
      mismatchCount: origNormalized === typedNormalized ? 0 : 1,
    }
  }

  let mismatchCount = 0
  const maxLen = Math.max(original.length, typed.length)

  for (let i = 0; i < maxLen; i++) {
    if (original[i] !== typed[i]) {
      mismatchCount++
    }
  }

  return {
    isMatch: mismatchCount === 0,
    mismatchCount,
  }
}

/**
 * Находит первую позицию расхождения
 */
export function findFirstMismatch(original: string, typed: string): number {
  const maxLen = Math.max(original.length, typed.length)

  for (let i = 0; i < maxLen; i++) {
    if (original[i] !== typed[i]) {
      return i
    }
  }

  return -1
}
