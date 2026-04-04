import { memo, RefObject } from 'react'

interface CharSpanProps {
  char: string
  status: 'correct' | 'incorrect' | 'pending' | 'current'
  isCurrent: boolean
  caretRef?: RefObject<HTMLSpanElement>
  bracketClass?: string
  isNextChar?: boolean
}

export const CharSpan = memo(function CharSpan({
  char,
  status,
  isCurrent,
  caretRef,
  bracketClass = '',
  isNextChar = false,
}: CharSpanProps) {
  // Определяем класс
  let className = 'char '

  if (status === 'correct') {
    className += 'correct'
  } else if (status === 'incorrect') {
    className += 'incorrect'
  } else if (isCurrent) {
    className += 'current'
  } else {
    className += 'pending'
  }

  if (bracketClass) className += ` ${bracketClass}`
  if (isNextChar) className += ' next-char-highlight'

  // Для текущего символа — рендерим caret отдельно
  if (isCurrent) {
    return (
      <span ref={caretRef} className={className}>
        {char}
      </span>
    )
  }

  return <span className={className}>{char}</span>
})
