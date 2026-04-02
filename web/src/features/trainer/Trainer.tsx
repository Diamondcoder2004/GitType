import { useEffect, useMemo, useRef, useCallback } from 'react'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { processTyping, getCharStatuses } from '../../core/typing/typingEngine'
import { calculateStats } from '../../core/typing/statsEngine'
import './Trainer.css'

export function Trainer() {
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
  } = useAppStore(
    (state) => ({
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
    }),
    shallow
  )

  const typingAreaRef = useRef<HTMLDivElement>(null)
  const currentCharRef = useRef<HTMLSpanElement>(null)

  const targetText = useMemo(
    () => (mode === 'full-file' ? fileContent || '' : selectedBlock?.code || ''),
    [mode, fileContent, selectedBlock]
  )

  const charStatuses = useMemo(
    () => getCharStatuses(targetText, userInput),
    [targetText, userInput]
  )

  useEffect(() => {
    typingAreaRef.current?.focus({ preventScroll: true })
  }, [selectedBlock, mode])

  useEffect(() => {
    if (!currentCharRef.current || !typingAreaRef.current) return

    const currentChar = currentCharRef.current
    const container = typingAreaRef.current

    const animationFrame = requestAnimationFrame(() => {
      const charTop = currentChar.offsetTop
      const charBottom = charTop + currentChar.offsetHeight
      const viewTop = container.scrollTop
      const viewBottom = viewTop + container.clientHeight
      const safePadding = 32

      if (charTop < viewTop + safePadding) {
        container.scrollTop = Math.max(charTop - safePadding, 0)
      } else if (charBottom > viewBottom - safePadding) {
        container.scrollTop = charBottom - container.clientHeight + safePadding
      }
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [userInput])

  const resetTypingState = useCallback(() => {
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setStats(null)
    setIsComplete(false)
  }, [setUserInput, setStartTime, setEndTime, setStats, setIsComplete])

  const handleContainerClick = () => {
    typingAreaRef.current?.focus({ preventScroll: true })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!targetText) return

    if (e.key === 'Escape') {
      e.preventDefault()
      resetTypingState()
      typingAreaRef.current?.focus({ preventScroll: true })
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const newValue = userInput + '    '
      if (newValue.length <= targetText.length) {
        if (!startTime) setStartTime(Date.now())
        setUserInput(newValue)
      }
      return
    }

    if (e.key === 'Backspace') {
      return
    }

    if (e.key.length === 1 || e.key === 'Enter') {
      e.preventDefault()

      const nextChar = e.key === 'Enter' ? '\n' : e.key
      const newValue = userInput + nextChar

      if (newValue.length > targetText.length) return

      setUserInput(newValue)

      if (!startTime) {
        setStartTime(Date.now())
      }

      if (newValue.length === targetText.length && !isComplete) {
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

  const handleModeToggle = () => {
    setMode(mode === 'full-file' ? 'code-block' : 'full-file')
    resetTypingState()
    setTimeout(() => typingAreaRef.current?.focus({ preventScroll: true }), 0)
  }

  const renderCodeDisplay = () => {
    if (!targetText) return null

    return targetText.split('').map((char, index) => {
      const status = charStatuses[index]
      const isCurrent = index === userInput.length

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

      return (
        <span
          key={index}
          ref={isCurrent ? currentCharRef : null}
          className={className}
        >
          {char}
        </span>
      )
    })
  }

  const progress = useMemo(
    () => (targetText ? (userInput.length / targetText.length) * 100 : 0),
    [targetText, userInput.length]
  )

  return (
    <div className="trainer">
      <div className="trainer-header">
        <div className="block-info">
          {mode === 'code-block' && selectedBlock ? (
            <>
              <span className="block-type">{selectedBlock.type}</span>
              <span className="block-name">{selectedBlock.name}</span>
              <span className="block-complexity">
                Сложность: {selectedBlock.complexity}
              </span>
            </>
          ) : (
            <span className="block-type">Весь файл</span>
          )}
        </div>

        <div className="trainer-controls">
          <button onClick={handleModeToggle} className="mode-btn">
            {mode === 'full-file' ? 'Режим: Блок кода' : 'Режим: Весь файл'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-bar">
          <div className="stat">
            <div className="stat-value">{stats.wpm}</div>
            <div className="stat-label">WPM</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.accuracy}%</div>
            <div className="stat-label">Точность</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.errors}</div>
            <div className="stat-label">Ошибки</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.duration}s</div>
            <div className="stat-label">Время</div>
          </div>
        </div>
      )}

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div
        ref={typingAreaRef}
        className="typing-area"
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="code-display">
          {renderCodeDisplay()}
        </div>
      </div>

      {isComplete && (
        <div className="complete-message">
          🎉 Отлично! Упражнение завершено
        </div>
      )}

      <div className="hint-message">
        ESC - перезапуск | TAB - 4 пробела | Кликните по области для фокуса
      </div>
    </div>
  )
}
