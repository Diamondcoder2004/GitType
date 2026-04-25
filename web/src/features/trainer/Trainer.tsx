import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { calculateStats, type TypingStats } from '../../core/typing/statsEngine'
import './Trainer.css'

type SessionMode = 'classic' | 'time' | 'words'

interface SessionRecord {
  at: number
  repo: string
  mode: SessionMode
  wpm: number
  accuracy: number
  errors: number
}

const HISTORY_STORAGE_KEY = 'gittype_session_history'

function getWordBoundaries(text: string, position: number, direction: 'left' | 'right'): number {
  if (direction === 'left') {
    if (position <= 0) return 0
    let cursor = position - 1
    while (cursor > 0 && /\s/.test(text[cursor])) cursor--
    while (cursor > 0 && !/\s/.test(text[cursor - 1])) cursor--
    return cursor
  }

  if (position >= text.length) return text.length
  let cursor = position
  while (cursor < text.length && !/\s/.test(text[cursor])) cursor++
  while (cursor < text.length && /\s/.test(text[cursor])) cursor++
  return cursor
}

function toInputString(chars: string[]): string {
  return chars.join('')
}

function getHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(history: SessionRecord[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-150)))
}

export function Trainer() {
  const {
    mode,
    selectedBlock,
    fileContent,
    startTime,
    isComplete,
    stats,
    codeBlocks,
    selectedRepo,
    setUserInput,
    setStartTime,
    setEndTime,
    setStats,
    setIsComplete,
    setMode,
    setSelectedBlock,
  } = useAppStore(
    (state) => ({
      mode: state.mode,
      selectedBlock: state.selectedBlock,
      fileContent: state.fileContent,
      startTime: state.startTime,
      isComplete: state.isComplete,
      stats: state.stats,
      codeBlocks: state.codeBlocks,
      selectedRepo: state.selectedRepo,
      setUserInput: state.setUserInput,
      setStartTime: state.setStartTime,
      setEndTime: state.setEndTime,
      setStats: state.setStats,
      setIsComplete: state.setIsComplete,
      setMode: state.setMode,
      setSelectedBlock: state.setSelectedBlock,
    }),
    shallow
  )

  const typingAreaRef = useRef<HTMLDivElement>(null)
  const currentCharRef = useRef<HTMLSpanElement>(null)

  const [sessionMode, setSessionMode] = useState<SessionMode>('classic')
  const [timeLimit, setTimeLimit] = useState<15 | 30 | 60>(30)
  const [wordsLimit, setWordsLimit] = useState<25 | 50 | 100>(50)
  const [remainingTime, setRemainingTime] = useState(timeLimit)
  const [caretPos, setCaretPos] = useState(0)
  const [inputChars, setInputChars] = useState<string[]>([])
  const [autoNext, setAutoNext] = useState(false)

  const targetText = useMemo(
    () => (mode === 'full-file' ? fileContent || '' : selectedBlock?.code || ''),
    [mode, fileContent, selectedBlock]
  )

  const effectiveTarget = useMemo(() => {
    if (sessionMode !== 'words') return targetText
    const words = targetText.trim().split(/\s+/).filter(Boolean)
    return words.slice(0, wordsLimit).join(' ')
  }, [targetText, sessionMode, wordsLimit])

  const typedChars = useMemo(
    () => inputChars.reduce((acc, char) => acc + (char ? 1 : 0), 0),
    [inputChars]
  )

  const charStatuses = useMemo(() => {
    return effectiveTarget.split('').map((targetChar, index) => {
      const typedChar = inputChars[index]
      if (index === caretPos && !typedChar) return 'current'
      if (!typedChar) return 'pending'
      return typedChar === targetChar ? 'correct' : 'incorrect'
    })
  }, [effectiveTarget, inputChars, caretPos])

  const progress = useMemo(() => {
    if (!effectiveTarget.length) return 0
    return Math.min(100, (typedChars / effectiveTarget.length) * 100)
  }, [effectiveTarget.length, typedChars])

  const exerciseHistory = useMemo(() => {
    if (!selectedRepo) return []
    const repoKey = `${selectedRepo.owner}/${selectedRepo.repo}`
    return getHistory().filter((entry) => entry.repo === repoKey).slice(-10)
  }, [selectedRepo, stats])

  const resetTypingState = useCallback(() => {
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setStats(null)
    setIsComplete(false)
    setCaretPos(0)
    setInputChars([])
    setRemainingTime(timeLimit)
  }, [setUserInput, setStartTime, setEndTime, setStats, setIsComplete, timeLimit])

  const completeSession = useCallback(
    (completedAt: number) => {
      if (isComplete || !startTime || !effectiveTarget) return

      const input = toInputString(inputChars)
      const evaluatedLength = Math.min(input.length, effectiveTarget.length)
      let correctChars = 0
      for (let i = 0; i < evaluatedLength; i++) {
        if (input[i] === effectiveTarget[i]) correctChars++
      }

      const errors = Math.max(evaluatedLength - correctChars, 0)
      const finalStats: TypingStats = calculateStats(
        startTime,
        completedAt,
        evaluatedLength,
        correctChars,
        errors
      )

      setEndTime(completedAt)
      setStats(finalStats)
      setIsComplete(true)

      if (selectedRepo) {
        const repoKey = `${selectedRepo.owner}/${selectedRepo.repo}`
        const history = getHistory()
        history.push({
          at: completedAt,
          repo: repoKey,
          mode: sessionMode,
          wpm: finalStats.wpm,
          accuracy: finalStats.accuracy,
          errors: finalStats.errors,
        })
        saveHistory(history)
      }
    },
    [isComplete, startTime, effectiveTarget, inputChars, setEndTime, setStats, setIsComplete, selectedRepo, sessionMode]
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
  }, [caretPos, charStatuses])

  useEffect(() => {
    setRemainingTime(timeLimit)
  }, [timeLimit, sessionMode])

  useEffect(() => {
    if (sessionMode !== 'time' || !startTime || isComplete) return

    const timer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      const next = Math.max(0, timeLimit - elapsedSeconds)
      setRemainingTime(next)
      if (next === 0) {
        completeSession(Date.now())
      }
    }, 200)

    return () => window.clearInterval(timer)
  }, [sessionMode, startTime, timeLimit, isComplete, completeSession])

  useEffect(() => {
    if (!isComplete || !autoNext || mode !== 'code-block') return

    const timeout = window.setTimeout(() => {
      const alternatives = codeBlocks.filter((block) => block.id !== selectedBlock?.id)
      if (alternatives.length > 0) {
        const nextBlock = alternatives[Math.floor(Math.random() * alternatives.length)]
        setSelectedBlock(nextBlock)
      }
      resetTypingState()
    }, 1500)

    return () => window.clearTimeout(timeout)
  }, [isComplete, autoNext, mode, codeBlocks, selectedBlock, setSelectedBlock])

  const handleContainerClick = () => {
    typingAreaRef.current?.focus({ preventScroll: true })
  }

  const setCharAt = (index: number, value: string) => {
    setInputChars((prev) => {
      const next = [...prev]
      next[index] = value
      setUserInput(toInputString(next))
      return next
    })
  }

  const clearCharAt = (index: number) => {
    setInputChars((prev) => {
      const next = [...prev]
      next[index] = ''
      setUserInput(toInputString(next))
      return next
    })
  }

  const maybeStartSession = () => {
    if (!startTime) {
      const now = Date.now()
      setStartTime(now)
      if (sessionMode === 'time') setRemainingTime(timeLimit)
    }
    if (isComplete) {
      setIsComplete(false)
      setStats(null)
      setEndTime(null)
    }
  }

  const maybeCompleteByText = (nextCaretPos: number) => {
    if (sessionMode !== 'classic' && sessionMode !== 'words') return
    if (nextCaretPos < effectiveTarget.length) return
    completeSession(Date.now())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!effectiveTarget) return

    if (e.key === 'Escape') {
      e.preventDefault()
      resetTypingState()
      typingAreaRef.current?.focus({ preventScroll: true })
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      setCaretPos(0)
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
      e.preventDefault()
      setCaretPos((prev) => getWordBoundaries(effectiveTarget, prev, 'left'))
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
      e.preventDefault()
      setCaretPos((prev) => getWordBoundaries(effectiveTarget, prev, 'right'))
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
      e.preventDefault()
      maybeStartSession()
      const nextPos = getWordBoundaries(effectiveTarget, caretPos, 'left')
      for (let i = nextPos; i < caretPos; i++) {
        clearCharAt(i)
      }
      setCaretPos(nextPos)
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setCaretPos((prev) => Math.max(0, prev - 1))
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setCaretPos((prev) => Math.min(effectiveTarget.length, prev + 1))
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      setCaretPos(0)
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      setCaretPos(effectiveTarget.length)
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      maybeStartSession()
      clearCharAt(caretPos)
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (caretPos === 0) return
      maybeStartSession()
      const nextPos = caretPos - 1
      clearCharAt(nextPos)
      setCaretPos(nextPos)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      maybeStartSession()
      for (let offset = 0; offset < 4; offset++) {
        const idx = caretPos + offset
        if (idx >= effectiveTarget.length) break
        setCharAt(idx, ' ')
      }
      const nextPos = Math.min(caretPos + 4, effectiveTarget.length)
      setCaretPos(nextPos)
      maybeCompleteByText(nextPos)
      return
    }

    if (e.key.length === 1 || e.key === 'Enter') {
      e.preventDefault()
      if (caretPos >= effectiveTarget.length) return
      maybeStartSession()

      const nextChar = e.key === 'Enter' ? '\n' : e.key
      setCharAt(caretPos, nextChar)
      const nextPos = Math.min(caretPos + 1, effectiveTarget.length)
      setCaretPos(nextPos)
      maybeCompleteByText(nextPos)
    }
  }

  const handleModeToggle = () => {
    setMode(mode === 'full-file' ? 'code-block' : 'full-file')
    resetTypingState()
    setTimeout(() => typingAreaRef.current?.focus({ preventScroll: true }), 0)
  }

  const handleNextTest = () => {
    if (mode !== 'code-block') return
    const alternatives = codeBlocks.filter((block) => block.id !== selectedBlock?.id)
    if (alternatives.length === 0) return
    const nextBlock = alternatives[Math.floor(Math.random() * alternatives.length)]
    setSelectedBlock(nextBlock)
    resetTypingState()
  }

  const renderCodeDisplay = () => {
    if (!effectiveTarget) return null

    return effectiveTarget.split('').map((char, index) => {
      const status = charStatuses[index]
      const isCurrent = index === caretPos

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
          <select
            className="mode-btn"
            value={sessionMode}
            onChange={(e) => {
              setSessionMode(e.target.value as SessionMode)
              resetTypingState()
            }}
          >
            <option value="classic">Classic</option>
            <option value="time">Time</option>
            <option value="words">Words</option>
          </select>

          {sessionMode === 'time' && (
            <select
              className="mode-btn"
              value={timeLimit}
              onChange={(e) => {
                setTimeLimit(Number(e.target.value) as 15 | 30 | 60)
                resetTypingState()
              }}
            >
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          )}

          {sessionMode === 'words' && (
            <select
              className="mode-btn"
              value={wordsLimit}
              onChange={(e) => {
                setWordsLimit(Number(e.target.value) as 25 | 50 | 100)
                resetTypingState()
              }}
            >
              <option value={25}>25 words</option>
              <option value={50}>50 words</option>
              <option value={100}>100 words</option>
            </select>
          )}

          <button onClick={handleModeToggle} className="mode-btn">
            {mode === 'full-file' ? 'Режим: Блок кода' : 'Режим: Весь файл'}
          </button>

          {mode === 'code-block' && (
            <button onClick={handleNextTest} className="mode-btn">
              Next test
            </button>
          )}
        </div>
      </div>

      {sessionMode === 'time' && (
        <div className="timer-bar">Осталось: {remainingTime}s</div>
      )}

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
          🎉 Сессия завершена
          {mode === 'code-block' && (
            <label className="auto-next-toggle">
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => setAutoNext(e.target.checked)}
              />
              Auto-next block
            </label>
          )}
        </div>
      )}

      {exerciseHistory.length > 0 && (
        <div className="history-panel">
          <div className="history-title">Прогресс по репозиторию (последние 10)</div>
          <div className="history-bars">
            {exerciseHistory.map((entry) => (
              <div key={entry.at} className="history-item">
                <div
                  className="history-bar"
                  style={{ height: `${Math.max(6, Math.min(100, entry.wpm))}%` }}
                  title={`${entry.wpm} WPM, ${entry.accuracy}%`}
                />
                <div className="history-meta">{entry.wpm}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hint-message">
        ESC - перезапуск | TAB - 4 пробела | ←/→, Home/End, Ctrl/Cmd+←/→, Ctrl/Cmd+Backspace
      </div>
    </div>
  )
}
