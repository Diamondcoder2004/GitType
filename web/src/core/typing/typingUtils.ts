import { CodeBlock } from '../ast/languageAdapter'

/**
 * Вычисление burst speed (пиковая скорость за последние N символов)
 */
export function calculateBurstSpeed(userInput: string, startTime: number | null): number {
  if (!startTime || userInput.length < 5) return 0
  
  const elapsed = (Date.now() - startTime) / 1000 / 60 // минуты
  if (elapsed < 0.01) return 0
  
  const recentChars = userInput.slice(-10)
  const burstWpm = Math.round((recentChars.length / 5) / (elapsed / userInput.length * 10))
  return Math.min(burstWpm, 999)
}

/**
 * Вычисление consistency (стабильность печати)
 */
export function calculateConsistency(userInput: string, targetText: string): number {
  if (userInput.length < 10) return 100
  
  let consistent = 0
  const windowSize = 10
  
  for (let i = 0; i <= userInput.length - windowSize; i++) {
    const window = userInput.slice(i, i + windowSize)
    const target = targetText.slice(i, i + windowSize)
    let matches = 0
    for (let j = 0; j < windowSize; j++) {
      if (window[j] === target[j]) matches++
    }
    // Все 10 символов окна должны совпадать для консистентности
    if (matches === windowSize) consistent++
  }
  
  return Math.round((consistent / (userInput.length - windowSize + 1)) * 100)
}

/**
 * Генерация текста для режима words
 */
export function generateWordsText(codeBlocks: CodeBlock[], targetWords: number): string {
  if (codeBlocks.length === 0) return ''
  
  const allCode = codeBlocks.map(b => b.code).join('\n\n')
  const words = allCode.split(/\s+/).filter(w => w.length > 0)
  
  // Перемешиваем и берем нужное количество
  const shuffled = words.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, targetWords)
  
  return selected.join(' ')
}
