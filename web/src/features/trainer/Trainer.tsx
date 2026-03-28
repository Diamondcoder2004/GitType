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

  // Авто-скролл к текущему символу
  useEffect(() => {
    if (currentCharRef.current && codeDisplayRef.current) {
      const currentChar = currentCharRef.current
      const container = codeDisplayRef.current
      
      // Центрируем текущий символ по вертикали
      const charRect = currentChar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const relativeTop = charRect.top - containerRect.top
      
      // Если символ выходит за пределы, скроллим
      if (relativeTop < 50 || relativeTop > containerRect.height - 50) {
        currentChar.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [userInput])

  // Фокус на input при клике
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  // Обработка ввода
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (!startTime && value.length > 0) {
      setStartTime(Date.now())
    }

    // Ограничиваем длину ввода длиной целевого текста
    if (value.length <= targetText.length) {
      setUserInput(value)

      // Проверка завершения - когда дошли до конца текста
      if (value.length === targetText.length && !isComplete) {
        setEndTime(Date.now())
        setIsComplete(true)

        const result = processTyping(targetText, value)
        const finalStats = calculateStats(
          startTime || Date.now(),
          Date.now(),
          value.length,
          result.correctChars,
          result.errors
        )
        setStats(finalStats)
      }
    }
  }

  // Обработка клавиш
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      setTimeout(() => inputRef.current?.focus(), 10)
      return
    }

    // Обработка Enter - разрешаем обычный перенос строки
    if (e.key === 'Enter') {
      // Если ещё не дошли до конца, разрешаем Enter
      if (userInput.length < targetText.length) {
        // Проверяем, что следующий символ - это перенос строки
        const nextChar = targetText[userInput.length]
        if (nextChar === '\n') {
          // Разрешаем Enter пройти через input
          return
        }
      }
      // Если Enter в конце - завершаем
      if (userInput.length >= targetText.length && !isComplete) {
        e.preventDefault()
        setEndTime(Date.now())
        setIsComplete(true)
        
        const result = processTyping(targetText, userInput)
        const finalStats = calculateStats(
          startTime || Date.now(),
          Date.now(),
          userInput.length,
          result.correctChars,
          result.errors
        )
        setStats(finalStats)
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

  // Рендеринг текста с подсветкой и сохранением форматирования
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

      // Отображение специальных символов с сохранением форматирования
      let displayChar: React.ReactNode = char
      let charClass = ''

      if (char === '\n') {
        displayChar = (
          <>
            <span className="special-char">↵</span>
            <br />
          </>
        )
        charClass = 'newline'
      } else if (char === '\t') {
        displayChar = <span className="special-char">→···</span>
        charClass = 'tab'
      } else if (char === ' ') {
        displayChar = <span className="space-char">·</span>
      }

      return (
        <span
          key={index}
          ref={isCurrent ? currentCharRef : null}
          className={`${className} ${charClass}`}
        >
          {displayChar}
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
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={!targetText}
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
