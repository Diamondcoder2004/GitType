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
    return expected === actual
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
  return target[index] === userInput[index]
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
      statuses.push(target[i] === userInput[i] ? 'correct' : 'incorrect')
    } else if (i === userInput.length) {
      statuses.push('current')
    } else {
      statuses.push('pending')
    }
  }

  return statuses
}
