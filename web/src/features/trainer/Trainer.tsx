import { useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { processTyping, getCharStatuses } from '../../core/typing/typingEngine'
import { calculateStats } from '../../core/typing/statsEngine'
import './Trainer.css'

function getMonacoLanguage(filePath: string | null): string {
  if (!filePath) return 'typescript'
  
  const ext = filePath.split('.').pop()?.toLowerCase()
  
  if (!ext) return 'plaintext'
  
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  }
  
  return languageMap[ext] || 'plaintext'
}

export function Trainer() {
  const {
    mode,
    selectedBlock,
    fileContent,
    selectedFile,
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
  } = useAppStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const codeDisplayRef = useRef<HTMLDivElement>(null)
  const currentCharRef = useRef<HTMLSpanElement>(null)

  // Целевой текст для печати
  const targetText = mode === 'full-file'
    ? fileContent || ''
    : selectedBlock?.code || ''

  // Получаем статусы символов
  const charStatuses = getCharStatuses(targetText, userInput)

  // Авто-скролл к текущему символу (только внутри typing-area)
  useEffect(() => {
    if (currentCharRef.current && codeDisplayRef.current) {
      const currentChar = currentCharRef.current
      const container = codeDisplayRef.current
      
      const charRect = currentChar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const relativeTop = charRect.top - containerRect.top
      
      // Скроллим только если символ выходит за пределы видимой области
      if (relativeTop < 20 || relativeTop > containerRect.height - 20) {
        currentChar.scrollIntoView({ behavior: 'auto', block: 'nearest' })
      }
    }
  }, [userInput])

  // Фокус на input при клике
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  // Обработка ввода - используем onKeyDown для перехвата всех клавиш
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape для перезапуска
    if (e.key === 'Escape') {
      e.preventDefault()
      setUserInput('')
      setStartTime(null)
      setEndTime(null)
      setStats(null)
      setIsComplete(false)
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    // Tab для вставки отступа (4 пробела)
    if (e.key === 'Tab') {
      e.preventDefault()
      const newValue = userInput + '    '
      if (newValue.length <= targetText.length) {
        setUserInput(newValue)
      }
      return
    }

    // Обработка специальных клавиш
    if (e.key === 'Backspace') {
      // Разрешаем Backspace
      return
    }

    // Все остальные клавиши обрабатываем вручную
    if (e.key.length === 1 || e.key === 'Enter') {
      e.preventDefault()
      
      const newValue = userInput + (e.key === 'Enter' ? '\n' : e.key)
      
      if (newValue.length <= targetText.length) {
        setUserInput(newValue)

        if (!startTime) {
          setStartTime(Date.now())
        }

        // Проверка завершения
        if (newValue.length === targetText.length && !isComplete) {
          setEndTime(Date.now())
          setIsComplete(true)

          const result = processTyping(targetText, newValue)
          const finalStats = calculateStats(
            startTime || Date.now(),
            Date.now(),
            newValue.length,
            result.correctChars,
            result.errors
          )
          setStats(finalStats)
        }
      }
    }
  }

  const handleModeToggle = () => {
    setMode(mode === 'full-file' ? 'code-block' : 'full-file')
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setStats(null)
    setIsComplete(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Рендеринг текста с подсветкой
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

  const progress = targetText ? (userInput.length / targetText.length) * 100 : 0

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
            {mode === 'full-file' ? '📄 Весь файл' : '🔹 Блок кода'}
          </button>
        </div>
      </div>

      {stats && isComplete && (
        <div className="stats-bar">
          <div className="stat">
            <div className="stat-value">{stats.wpm}</div>
            <div className="stat-label">WPM</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.cpm}</div>
            <div className="stat-label">CPM</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.accuracy}%</div>
            <div className="stat-label">Точность</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.duration}с</div>
            <div className="stat-label">Время</div>
          </div>
        </div>
      )}

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div
        className="typing-area"
        onClick={handleContainerClick}
        ref={codeDisplayRef}
        tabIndex={0}
      >
        {targetText ? (
          <div className="code-display">
            {renderCodeDisplay()}
          </div>
        ) : (
          <div className="loading">
            Выберите файл для начала тренировки
          </div>
        )}

        {/* Скрытый input для перехвата ввода */}
        <input
          ref={inputRef}
          type="text"
          className="hidden-input"
          value=""
          onKeyDown={handleKeyDown}
          disabled={!targetText || isComplete}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>

      {isComplete && (
        <div className="complete-message">
          🎉 Тренировка завершена! Нажми <strong>Escape</strong> для перезапуска
        </div>
      )}

      {!isComplete && targetText && (
        <div className="hint-message">
          <strong>Tab</strong> — отступ &nbsp;|&nbsp; 
          <strong>Enter</strong> — перенос строки &nbsp;|&nbsp; 
          <strong>Escape</strong> — перезапуск
        </div>
      )}
    </div>
  )
}
