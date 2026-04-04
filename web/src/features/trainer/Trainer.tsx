import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { processTyping, getCharStatuses, findWordBoundary } from '../../core/typing/typingEngine'
import { calculateStats, calculateLiveStats, TypingStats } from '../../core/typing/statsEngine'
import { CharSpan } from './CharSpan'
import './Trainer.css'

interface TrainerProps {
  fontSize?: number
  onNextBlock?: () => void
  onRestart?: () => void
  bracketPairColorization?: boolean
  indentationGuides?: boolean
  highlightNextChar?: boolean
  caretStyle?: 'block' | 'line' | 'underline' | 'block-outline'
  caretColor?: string
  textStyle?: 'normal' | 'bright' | 'muted'
}

export function Trainer({
  fontSize = 16,
  onNextBlock,
  onRestart,
  bracketPairColorization = false,
  indentationGuides = false,
  highlightNextChar = false,
  caretStyle = 'block',
  caretColor = 'theme',
  textStyle = 'normal',
}: TrainerProps) {
  const {
    mode,
    selectedBlock,
    fileContent,
    userInput,
    startTime,
    isComplete,
    stats,
    setUserInput,
    setStartTime,
    setEndTime,
    setStats,
    setIsComplete,
    setMode,
    resetTrainer,
  } = useAppStore(
    useShallow((state) => ({
      mode: state.mode,
      selectedBlock: state.selectedBlock,
      fileContent: state.fileContent,
      userInput: state.userInput,
      startTime: state.startTime,
      isComplete: state.isComplete,
      stats: state.stats,
      setUserInput: state.setUserInput,
      setStartTime: state.setStartTime,
      setEndTime: state.setEndTime,
      setStats: state.setStats,
      setIsComplete: state.setIsComplete,
      setMode: state.setMode,
      resetTrainer: state.resetTrainer,
    }))
  )

  const typingAreaRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const [liveStats, setLiveStats] = useState<TypingStats | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const backspaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backspaceHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const backspaceIsCtrlRef = useRef(false)
  const userInputRef = useRef(userInput)

  // Нормализация дефисов для отображения — все виды тире → обычный дефис
  const normalizeDash = (char: string): string => {
    if (char === '–' || char === '—' || char === '−' || char === '‐' || char === '‑' || char === '‒') {
      return '-'
    }
    return char
  }

  // Синхронизируем ref с актуальным userInput
  useEffect(() => {
    userInputRef.current = userInput
  }, [userInput])

  // Применяем цвет курсора
  useEffect(() => {
    const root = document.documentElement
    if (caretColor === 'theme') {
      root.style.removeProperty('--caret-color')
    } else {
      root.style.setProperty('--caret-color', caretColor)
    }
  }, [caretColor])

  const targetText = useMemo(
    () => (mode === 'full-file' ? fileContent || '' : selectedBlock?.code || ''),
    [mode, fileContent, selectedBlock]
  )

  // Нормализованный текст для отображения (все тире → обычный дефис)
  const displayText = useMemo(
    () => targetText.split('').map(normalizeDash).join(''),
    [targetText]
  )

  // Разбиваем текст на строки для горизонтального скролла и номеров строк
  const textLines = useMemo(() => displayText.split('\n'), [displayText])

  const charStatuses = useMemo(
    () => getCharStatuses(targetText, userInput),
    [targetText, userInput]
  )

  // Live stats обновление каждые 500ms
  useEffect(() => {
    if (!startTime || isComplete) {
      setLiveStats(null)
      return
    }

    const update = () => {
      const ls = calculateLiveStats(startTime, userInput, targetText)
      setLiveStats(ls)
    }

    update()
    const interval = setInterval(update, 500)
    return () => clearInterval(interval)
  }, [startTime, userInput, targetText, isComplete])

  // Smooth caret scroll
  useEffect(() => {
    if (!caretRef.current || !typingAreaRef.current) return

    const caret = caretRef.current
    const container = typingAreaRef.current

    const animationFrame = requestAnimationFrame(() => {
      const caretRect = caret.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const relativeTop = caretRect.top - containerRect.top + container.scrollTop
      const relativeBottom = relativeTop + caretRect.height
      const viewTop = container.scrollTop
      const viewBottom = viewTop + container.clientHeight
      const safePadding = 48

      if (relativeTop < viewTop + safePadding) {
        container.scrollTo({ top: Math.max(relativeTop - safePadding, 0), behavior: 'smooth' })
      } else if (relativeBottom > viewBottom - safePadding) {
        container.scrollTo({ top: relativeBottom - container.clientHeight + safePadding, behavior: 'smooth' })
      }
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [userInput])

  // Автофокус при монтировании
  useEffect(() => {
    const timer = setTimeout(() => {
      typingAreaRef.current?.focus({ preventScroll: true })
    }, 100)
    return () => clearTimeout(timer)
  }, [selectedBlock, mode])

  // Глобальный keydown для восстановления фокуса — как в Monkeytype
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Если фокус уже в typing area — ничего не делаем
      if (document.activeElement === typingAreaRef.current) return

      // Игнорируем служебные комбинации
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'F5' || e.key === 'F12') return

      // Если нажата печатная клавиша — фокусируем typing area
      if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
        typingAreaRef.current?.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const handleContainerClick = () => {
    typingAreaRef.current?.focus({ preventScroll: true })
  }

  const handleFocus = () => setIsFocused(true)
  const handleBlur = () => setIsFocused(false)

  // Очистка backspace таймеров
  const clearBackspaceTimers = useCallback(() => {
    if (backspaceHoldTimerRef.current) {
      clearTimeout(backspaceHoldTimerRef.current)
      backspaceHoldTimerRef.current = null
    }
    if (backspaceHoldIntervalRef.current) {
      clearInterval(backspaceHoldIntervalRef.current)
      backspaceHoldIntervalRef.current = null
    }
  }, [])

  // Cleanup при размонтировании
  useEffect(() => {
    return () => clearBackspaceTimers()
  }, [clearBackspaceTimers])

  const resetTypingState = useCallback(() => {
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setStats(null)
    setIsComplete(false)
    setLiveStats(null)
  }, [setUserInput, setStartTime, setEndTime, setStats, setIsComplete])

  const handleRestart = useCallback(() => {
    resetTypingState()
    typingAreaRef.current?.focus({ preventScroll: true })
    onRestart?.()
  }, [resetTypingState, onRestart])

  const handleNextBlock = useCallback(() => {
    resetTypingState()
    onNextBlock?.()
    setTimeout(() => typingAreaRef.current?.focus({ preventScroll: true }), 50)
  }, [resetTypingState, onNextBlock])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!targetText) return

    // Tab — вставка 4 пробелов (как в IDE)
    if (e.key === 'Tab') {
      e.preventDefault()
      const newValue = userInput + '    '
      if (newValue.length <= targetText.length) {
        if (!startTime) setStartTime(Date.now())
        setUserInput(newValue)
      }
      return
    }

    // Escape — сброс
    if (e.key === 'Escape') {
      e.preventDefault()
      resetTypingState()
      typingAreaRef.current?.focus({ preventScroll: true })
      return
    }

    // Backspace с поддержкой удержания
    if (e.key === 'Backspace') {
      e.preventDefault()
      clearBackspaceTimers()
      backspaceIsCtrlRef.current = e.ctrlKey || e.metaKey

      const doBackspace = () => {
        const current = userInputRef.current
        if (current.length > 0) {
          if (backspaceIsCtrlRef.current) {
            const wordStart = findWordBoundary(current, current.length)
            setUserInput(current.slice(0, wordStart))
          } else {
            setUserInput(current.slice(0, -1))
          }
        }
      }

      doBackspace()

      backspaceHoldTimerRef.current = setTimeout(() => {
        backspaceHoldIntervalRef.current = setInterval(doBackspace, 60)
      }, 300)

      return
    }

    clearBackspaceTimers()

    if (e.key.length === 1 || e.key === 'Enter') {
      e.preventDefault()

      if (isComplete) return

      const nextChar = e.key === 'Enter' ? '\n' : e.key
      const newValue = userInput + nextChar

      if (newValue.length > targetText.length) return

      setUserInput(newValue)

      if (!startTime) {
        setStartTime(Date.now())
      }

      if (newValue.length === targetText.length) {
        const endTime = Date.now()
        setEndTime(endTime)
        setIsComplete(true)

        const result = processTyping(targetText, newValue)
        const finalStats = calculateStats(
          startTime || endTime,
          endTime,
          newValue.length,
          result.correctChars,
          result.errors
        )
        setStats(finalStats)
      }
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace') {
      clearBackspaceTimers()
    }
  }

  const handleModeToggle = () => {
    setMode(mode === 'full-file' ? 'code-block' : 'full-file')
    resetTypingState()
    setTimeout(() => typingAreaRef.current?.focus({ preventScroll: true }), 0)
  }

  // Определяем какую статистику показывать
  const displayStats = isComplete ? stats : liveStats
  const progress = targetText ? (userInput.length / targetText.length) * 100 : 0

  // Рендерим строку символов с номером строки
  const renderLine = (lineText: string, lineIndex: number, globalStartIndex: number) => {
    const chars: JSX.Element[] = []

    // Indentation guide — вертикальная линия для каждого уровня отступа
    const indentLevel = lineText.search(/\S/)
    const hasIndent = indentLevel > 0 && indentationGuides

    for (let i = 0; i < lineText.length; i++) {
      const globalIndex = globalStartIndex + i
      const status = charStatuses[globalIndex]
      const isCurrent = globalIndex === userInput.length
      const char = lineText[i]

      // Bracket pair colorization
      let bracketClass = ''
      if (bracketPairColorization) {
        if ('()'.includes(char)) bracketClass = 'bracket-1'
        else if ('[]'.includes(char)) bracketClass = 'bracket-2'
        else if ('{}<>'.includes(char)) bracketClass = 'bracket-3'
      }

      // Highlight next char
      const isNextChar = highlightNextChar && isCurrent && status === 'current'

      chars.push(
        <CharSpan
          key={globalIndex}
          char={char}
          status={status}
          isCurrent={isCurrent}
          caretRef={isCurrent ? caretRef : undefined}
          bracketClass={bracketClass}
          isNextChar={isNextChar}
        />
      )
    }

    // Если курсор в конце этой строки
    const cursorAtLineEnd = userInput.length === globalStartIndex + lineText.length
    if (cursorAtLineEnd) {
      chars.push(<span key={`caret-${lineIndex}`} ref={caretRef} className={lineIndex === textLines.length - 1 ? 'caret caret-end' : 'caret'} />)
    }

    return (
      <div key={lineIndex} className="code-line">
        <span className="line-number">{lineIndex + 1}</span>
        <span className="line-content" data-indent-level={hasIndent ? Math.floor(indentLevel / 2) : undefined}>
          {chars}
        </span>
      </div>
    )
  }

  return (
    <div className="trainer">
      {/* Header trainer */}
      <div className="trainer-header">
        <div className="block-info">
          {mode === 'code-block' && selectedBlock ? (
            <>
              <span className="block-type">{selectedBlock.type}</span>
              <span className="block-name">{selectedBlock.name}</span>
            </>
          ) : (
            <span className="block-type">Весь файл</span>
          )}
        </div>
        <div className="trainer-controls">
          <button onClick={handleModeToggle} className="mode-btn" title="Переключить режим">
            {mode === 'full-file' ? 'Блок' : 'Файл'}
          </button>
        </div>
      </div>

      {/* Compact stats bar — всегда виден, без layout shift */}
      <div className={`stats-bar ${!displayStats && !isComplete ? 'stats-placeholder' : ''}`}>
        <span className="stat-item">
          <span className="stat-value">{displayStats?.wpm ?? 0}</span>
          <span className="stat-label">wpm</span>
        </span>
        <span className="stat-item">
          <span className="stat-value">{displayStats?.cpm ?? 0}</span>
          <span className="stat-label">cpm</span>
        </span>
        <span className="stat-item">
          <span className="stat-value">{displayStats?.accuracy ?? 100}%</span>
          <span className="stat-label">acc</span>
        </span>
        <span className="stat-item">
          <span className="stat-value stat-errors">{displayStats?.errors ?? 0}</span>
          <span className="stat-label">err</span>
        </span>
        <span className="stat-item">
          <span className="stat-value">{displayStats?.duration ?? 0}s</span>
          <span className="stat-label">time</span>
        </span>
        <span className="stat-separator" />
        <span className="stat-item stat-progress">
          <span className="stat-value">{Math.round(progress)}%</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Typing area */}
      <div
        ref={typingAreaRef}
        className={`typing-area ${isFocused ? 'focused' : ''} ${isComplete ? 'completed' : ''}`}
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        tabIndex={0}
        data-caret-style={caretStyle}
        data-text-style={textStyle}
      >
        <div className="code-display" style={{ fontSize: `${fontSize}px`, lineHeight: 1.55 }}>
          {displayText && (() => {
            let globalOffset = 0
            return textLines.map((line, lineIndex) => {
              const lineStartIndex = globalOffset
              globalOffset += line.length + 1 // +1 для \n
              return renderLine(line, lineIndex, lineStartIndex)
            })
          })()}
        </div>
      </div>

      {/* Completion actions */}
      {isComplete && (
        <div className="complete-bar">
          <span className="complete-text">🎉 {stats?.wpm} wpm · {stats?.accuracy}% accuracy · {stats?.errors} errors</span>
          <div className="complete-actions">
            <button onClick={handleRestart} className="action-btn">
              ↻ Повторить
            </button>
            {onNextBlock && (
              <button onClick={handleNextBlock} className="action-btn primary">
                Далее →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compact hints */}
      <div className="hint-bar">
        <span className="hint-key">Tab</span> отступ
        <span className="hint-sep">·</span>
        <span className="hint-key">⌫</span> удалить
        <span className="hint-sep">·</span>
        <span className="hint-key">Ctrl+⌫</span> слово
        <span className="hint-sep">·</span>
        <span className="hint-key">ESC</span> сброс
      </div>
    </div>
  )
}
