import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { processTyping, getCharStatuses, findWordBoundary, findNextWordEnd, findLineEnd, normalizeChar } from '../../core/typing/typingEngine'
import { calculateStats, calculateLiveStats, TypingStats } from '../../core/typing/statsEngine'
import { CharSpan } from './CharSpan'
import './Trainer.css'

interface TrainerProps {
  fontSize?: number
  onNextBlock?: () => void
  onPrevBlock?: () => void
  onRestart?: () => void
  bracketPairColorization?: boolean
  indentationGuides?: boolean
  highlightNextChar?: boolean
  caretStyle?: 'block' | 'line' | 'underline' | 'block-outline'
  caretColor?: string
  textStyle?: 'normal' | 'bright' | 'muted'
  strictMode?: boolean
  highlightCurrentLine?: boolean
  soundEnabled?: boolean
  showMinimap?: boolean
}

export function Trainer({
  fontSize = 16,
  onNextBlock,
  onPrevBlock,
  onRestart,
  bracketPairColorization = false,
  indentationGuides = false,
  highlightNextChar = false,
  caretStyle = 'block',
  caretColor = 'theme',
  textStyle = 'normal',
  strictMode = false,
  highlightCurrentLine = true,
  soundEnabled = false,
  showMinimap = false,
}: TrainerProps) {
  const {
    mode,
    selectedFile,
    selectedBlock,
    fileContent,
    userInput,
    startTime,
    isComplete,
    stats,
    skippedPositions,
    setUserInput,
    setStartTime,
    setEndTime,
    setStats,
    setIsComplete,
    setMode,
    setSkippedPositions,
    resetTrainer,
    addCompletedFile,
    addCompletedBlock,
  } = useAppStore(
    useShallow((state) => ({
      mode: state.mode,
      selectedFile: state.selectedFile,
      selectedBlock: state.selectedBlock,
      fileContent: state.fileContent,
      userInput: state.userInput,
      startTime: state.startTime,
      isComplete: state.isComplete,
      stats: state.stats,
      skippedPositions: state.skippedPositions,
      setUserInput: state.setUserInput,
      setStartTime: state.setStartTime,
      setEndTime: state.setEndTime,
      setStats: state.setStats,
      setIsComplete: state.setIsComplete,
      setMode: state.setMode,
      setSkippedPositions: state.setSkippedPositions,
      resetTrainer: state.resetTrainer,
      addCompletedFile: state.addCompletedFile,
      addCompletedBlock: state.addCompletedBlock,
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
  const skippedPositionsRef = useRef(skippedPositions)

  useEffect(() => {
    skippedPositionsRef.current = skippedPositions
  }, [skippedPositions])

  const audioContextRef = useRef<AudioContext | null>(null)

  const playSound = useCallback((type: 'click' | 'error') => {
    if (!soundEnabled) return
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') ctx.resume()
      
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      if (type === 'click') {
        osc.type = 'square'
        osc.frequency.setValueAtTime(150, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05)
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.05)
      } else {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(300, ctx.currentTime)
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      }
    } catch (e) {
      console.error(e)
    }
  }, [soundEnabled])

  // Нормализация символов для отображения — Unicode → ASCII
  const normalizeDisplay = (char: string): string => {
    return normalizeChar(char)
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
    () => targetText.split('').map(normalizeDisplay).join(''),
    [targetText]
  )

  // Разбиваем текст на строки для горизонтального скролла и номеров строк
  const textLines = useMemo(() => displayText.split('\n'), [displayText])

  const charStatuses = useMemo(
    () => getCharStatuses(targetText, userInput, skippedPositions),
    [targetText, userInput, skippedPositions]
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

  // Сохранение прогресса
  useEffect(() => {
    if (isComplete && stats && stats.accuracy >= 80) {
      if (mode === 'full-file' && selectedFile) {
        addCompletedFile(selectedFile)
      } else if (mode === 'code-block' && selectedBlock) {
        addCompletedBlock(selectedBlock.id)
      }
    }
  }, [isComplete, stats, mode, selectedFile, selectedBlock, addCompletedFile, addCompletedBlock])

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
  }, [userInput, caretStyle])

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

  const handleSkipWord = useCallback(() => {
    if (isComplete) return
    const currentPos = userInput.length
    const skipTo = findNextWordEnd(targetText, currentPos)
    if (skipTo > currentPos) {
      const newSkipped = new Set(skippedPositions || [])
      for (let i = currentPos; i < skipTo; i++) newSkipped.add(i)
      setSkippedPositions(newSkipped)
      const newValue = targetText.slice(0, skipTo)
      setUserInput(newValue)
      if (!startTime) setStartTime(Date.now())
      if (skipTo >= targetText.length) {
        const endTime = Date.now()
        setEndTime(endTime)
        setIsComplete(true)
        const result = processTyping(targetText, newValue)
        setStats(calculateStats(startTime || endTime, endTime, newValue.length, result.correctChars, result.errors))
      }
    }
    setTimeout(() => typingAreaRef.current?.focus({ preventScroll: true }), 0)
  }, [isComplete, userInput.length, targetText, skippedPositions, startTime, setSkippedPositions, setUserInput, setStartTime, setEndTime, setIsComplete, setStats])

  const handleSkipLine = useCallback(() => {
    if (isComplete) return
    const currentPos = userInput.length
    const skipTo = findLineEnd(targetText, currentPos)
    if (skipTo > currentPos) {
      const newSkipped = new Set(skippedPositions || [])
      for (let i = currentPos; i < skipTo; i++) newSkipped.add(i)
      setSkippedPositions(newSkipped)
      const newValue = targetText.slice(0, skipTo)
      setUserInput(newValue)
      if (!startTime) setStartTime(Date.now())
      if (skipTo >= targetText.length) {
        const endTime = Date.now()
        setEndTime(endTime)
        setIsComplete(true)
        const result = processTyping(targetText, newValue)
        setStats(calculateStats(startTime || endTime, endTime, newValue.length, result.correctChars, result.errors))
      }
    }
    setTimeout(() => typingAreaRef.current?.focus({ preventScroll: true }), 0)
  }, [isComplete, userInput.length, targetText, skippedPositions, startTime, setSkippedPositions, setUserInput, setStartTime, setEndTime, setIsComplete, setStats])

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

    // Навигация по блокам (Alt + Up/Down)
    if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault()
      if (mode === 'code-block' && onPrevBlock) onPrevBlock()
      return
    }
    if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault()
      if (mode === 'code-block' && onNextBlock) onNextBlock()
      return
    }

    // Ctrl+Enter — пропуск строки
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      handleSkipLine()
      return
    }

    // Ctrl+Shift+Enter — пропуск слова
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault()
      handleSkipWord()
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
          let newLength = current.length - 1
          if (backspaceIsCtrlRef.current) {
            newLength = findWordBoundary(current, current.length)
          }

          setUserInput(current.slice(0, newLength))

          // Отменяем "скип" (пропуск), если удаляем пропущенные символы
          const prevSkipped = skippedPositionsRef.current
          if (prevSkipped && prevSkipped.size > 0) {
            const nextSkipped = new Set(prevSkipped)
            let changed = false
            for (let i = current.length - 1; i >= newLength; i--) {
              if (nextSkipped.has(i)) {
                nextSkipped.delete(i)
                changed = true
              }
            }
            if (changed) {
              setSkippedPositions(nextSkipped.size > 0 ? nextSkipped : null)
            }
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
      const expectedChar = normalizeDisplay(targetText[userInput.length] || '')
      const isCorrect = normalizeDisplay(nextChar) === expectedChar

      if (!isCorrect) {
        playSound('error')
        if (strictMode) {
          // В строгом режиме не позволяем вводить ошибку, только играем звук
          return
        }
      } else {
        playSound('click')
      }

      const newValue = userInput + nextChar
      const remainingText = targetText.slice(newValue.length)
      const isOnlyWhitespaceLeft = remainingText.trim() === ''

      if (newValue.length > targetText.length) return

      setUserInput(newValue)

      if (!startTime) {
        setStartTime(Date.now())
      }

      if (newValue.length === targetText.length || (isOnlyWhitespaceLeft && remainingText.length > 0)) {
        // Если остался только whitespace, добиваем до конца автоматически
        if (isOnlyWhitespaceLeft && remainingText.length > 0) {
          const newSkipped = new Set(skippedPositionsRef.current || [])
          for (let i = newValue.length; i < targetText.length; i++) {
            newSkipped.add(i)
          }
          setSkippedPositions(newSkipped)
          setUserInput(targetText)
        }

        const endTime = Date.now()
        setEndTime(endTime)
        setIsComplete(true)

        const finalInput = isOnlyWhitespaceLeft ? targetText : newValue
        const result = processTyping(targetText, finalInput)
        const finalStats = calculateStats(
          startTime || endTime,
          endTime,
          targetText.length,
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

      // Рендерим caret ПЕРЕД текущим символом
      if (isCurrent) {
        chars.push(
          <span
            key={`caret-${lineIndex}`}
            ref={caretRef}
            className={lineIndex === textLines.length - 1 && i === lineText.length - 1 ? 'caret caret-end' : 'caret'}
          />
        )
      }

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
          bracketClass={bracketClass}
          isNextChar={isNextChar}
        />
      )
    }

    // Если курсор в самом конце строки (после последнего символа)
    const cursorAtLineEnd = userInput.length === globalStartIndex + lineText.length
    if (cursorAtLineEnd && lineText.length > 0) {
      chars.push(
        <span
          key={`caret-end-${lineIndex}`}
          ref={caretRef}
          className={lineIndex === textLines.length - 1 ? 'caret caret-end' : 'caret'}
        />
      )
    }

    const isCurrentLine = userInput.length >= globalStartIndex && userInput.length <= globalStartIndex + lineText.length
    const lineClass = `code-line ${highlightCurrentLine && isCurrentLine ? 'current-line' : ''}`

    return (
      <div key={lineIndex} className={lineClass}>
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
          <button onClick={handleSkipWord} className="mode-btn skip-btn" title="Пропустить слово (Ctrl+Shift+Enter)" disabled={isComplete}>
            Пропустить слово
          </button>
          <button onClick={handleModeToggle} className="mode-btn" title="Переключить режим">
            {mode === 'full-file' ? 'Блок' : 'Файл'}
          </button>
          {mode === 'code-block' && (
            <>
              <button onClick={onPrevBlock} className="mode-btn" title="Предыдущий блок (Alt+Up)">↑ Пред.</button>
              <button onClick={onNextBlock} className="mode-btn" title="Следующий блок (Alt+Down)">След. ↓</button>
            </>
          )}
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
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
        
        {/* Minimap */}
        {showMinimap && (
          <div className="minimap-container" aria-hidden="true">
            <div className="minimap-content" style={{ fontSize: `${Math.max(2, fontSize * 0.2)}px`, lineHeight: 1.55 }}>
              {displayText && (() => {
                let globalOffset = 0
                return textLines.map((line, lineIndex) => {
                  const lineStartIndex = globalOffset
                  globalOffset += line.length + 1
                  return renderLine(line, lineIndex, lineStartIndex)
                })
              })()}
            </div>
            {/* Viewport overlay could go here */}
          </div>
        )}
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
        <span className="hint-key">Ctrl+↵</span> пропуск строки
        <span className="hint-sep">·</span>
        <span className="hint-key" title="Пропуск слова">Ctrl+⇧+↵</span> пропуск слова
        <span className="hint-sep">·</span>
        <span className="hint-key">ESC</span> сброс
      </div>
    </div>
  )
}
