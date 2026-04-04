export interface TypingResult {
  correctChars: number
  errors: number
  accuracy: number
  completed: boolean
  currentPosition: number
}

export interface TypingMode {
  type: 'strict' | 'ignoreWhitespace'
}

/**
 * Нормализует дефисы и тире к единому символу
 * Решает проблему когда в коде используется en-dash/em-dash,
 * а пользователь вводит обычный hyphen-minus с клавиатуры
 */
function normalizeDash(char: string): string {
  // Все виды дефисов/тире → обычный hyphen-minus (U+002D)
  if (char === '–' || char === '—' || char === '−' || char === '‐' || char === '‑' || char === '‒') {
    return '-'
  }
  return char
}

/**
 * Движок проверки ввода пользователя
 * Pure function
 */
export function processTyping(
  target: string,
  userInput: string,
  mode: TypingMode = { type: 'strict' }
): TypingResult {
  let correctChars = 0
  let errors = 0

  const compareChars = (expected: string, actual: string): boolean => {
    if (mode.type === 'ignoreWhitespace') {
      return expected.trim() === actual.trim()
    }
    // Нормализуем дефисы перед сравнением
    return normalizeDash(expected) === normalizeDash(actual)
  }

  for (let i = 0; i < userInput.length; i++) {
    if (i >= target.length) {
      errors++
      continue
    }

    if (compareChars(target[i], userInput[i])) {
      correctChars++
    } else {
      errors++
    }
  }

  const totalTyped = userInput.length
  const accuracy = totalTyped > 0 ? (correctChars / totalTyped) * 100 : 100
  const completed = userInput.length >= target.length

  return {
    correctChars,
    errors,
    accuracy: Math.round(accuracy * 100) / 100,
    completed,
    currentPosition: userInput.length,
  }
}

/**
 * Определяет, является ли символ правильным на текущей позиции
 */
export function isCharCorrect(
  target: string,
  userInput: string,
  index: number
): boolean {
  if (index >= target.length || index >= userInput.length) {
    return false
  }
  return normalizeDash(target[index]) === normalizeDash(userInput[index])
}

/**
 * Возвращает массив статусов для каждого символа
 */
export function getCharStatuses(
  target: string,
  userInput: string
): ('correct' | 'incorrect' | 'pending' | 'current')[] {
  const statuses: ('correct' | 'incorrect' | 'pending' | 'current')[] = []

  for (let i = 0; i < target.length; i++) {
    if (i < userInput.length) {
      statuses.push(
        normalizeDash(target[i]) === normalizeDash(userInput[i]) ? 'correct' : 'incorrect'
      )
    } else if (i === userInput.length) {
      statuses.push('current')
    } else {
      statuses.push('pending')
    }
  }

  return statuses
}

/**
 * Находит позицию начала слова перед текущей позицией
 * Используется для Ctrl+Backspace
 */
export function findWordBoundary(text: string, position: number): number {
  // Идём назад, пропуская пробелы
  let pos = position - 1
  while (pos > 0 && /\s/.test(text[pos])) {
    pos--
  }
  // Идём назад, пока встречаем символы слов (буквы, цифры, _)
  while (pos > 0 && /[\w]/.test(text[pos - 1])) {
    pos--
  }
  return pos
}
