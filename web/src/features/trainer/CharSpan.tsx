import { memo } from 'react'

interface CharSpanProps {
  char: string
  status: 'correct' | 'incorrect' | 'pending' | 'current' | 'skipped'
  isCurrent: boolean
  bracketClass?: string
  isNextChar?: boolean
}

export const CharSpan = memo(function CharSpan({
  char,
  status,
  isCurrent,
  bracketClass = '',
  isNextChar = false,
}: CharSpanProps) {
  // Определяем класс
  let className = 'char '

  if (status === 'correct') {
    className += 'correct'
  } else if (status === 'incorrect') {
    className += 'incorrect'
  } else if (status === 'skipped') {
    className += 'skipped'
  } else if (isCurrent) {
    className += 'current'
  } else {
    className += 'pending'
  }

  if (bracketClass) className += ` ${bracketClass}`
  if (isNextChar) className += ' next-char-highlight'

  return <span className={className}>{char}</span>
})
