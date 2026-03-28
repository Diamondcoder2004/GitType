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

  // Целевой текст для печати
  const targetText = mode === 'full-file'
    ? fileContent || ''
    : selectedBlock?.code || ''

  // Получаем статусы символов
  const charStatuses = getCharStatuses(targetText, userInput)

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

    setUserInput(value.slice(0, targetText.length))

    // Проверка завершения
    if (value.length >= targetText.length && !isComplete) {
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

  // Обработка клавиш
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab для перезапуска
    if (e.key === 'Tab') {
      e.preventDefault()
      setUserInput('')
      setStartTime(null)
      setEndTime(null)
      setStats(null)
      setIsComplete(false)
      setTimeout(() => inputRef.current?.focus(), 50)
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
      let className = 'char '

      if (status === 'correct') {
        className += 'correct'
      } else if (status === 'incorrect') {
        className += 'incorrect'
      } else if (status === 'current') {
        className += 'current'
      } else {
        className += 'pending'
      }

      // Отображение специальных символов
      const displayChar = char === '\n' ? '↵' : char === ' ' ? '·' : char === '\t' ? '→   ' : char

      return (
        <span key={index} className={className}>
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
          🎉 Тренировка завершена! Нажми Tab для перезапуска
        </div>
      )}

      {!isComplete && targetText && (
        <div className="hint-message">
          Начни печатать код. Нажми <strong>Tab</strong> для перезапуска.
        </div>
      )}
    </div>
  )
}
