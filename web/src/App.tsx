import { useState, useEffect, useRef, useCallback } from 'react'
import { Octokit } from '@octokit/rest'
import './App.css'

interface TypingStats {
  wpm: number
  accuracy: number
  errors: number
  correctChars: number
  totalChars: number
  time: number
}

interface GitHubFile {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: GitHubFile[]
  expanded?: boolean
}

interface FlatFile {
  name: string
  path: string
  type: 'file'
}

const CODE_LANGUAGES = [
  'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'cs', 'php', 'rb', 'swift', 'kt'
]

function App() {
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token') || '')
  const [repoInput, setRepoInput] = useState('')
  const [files, setFiles] = useState<GitHubFile[]>([])
  const [flatFiles, setFlatFiles] = useState<FlatFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [code, setCode] = useState('')
  const [userInput, setUserInput] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState<string>('all')

  const inputRef = useRef<HTMLInputElement>(null)
  const codeDisplayRef = useRef<HTMLDivElement>(null)

  const octokit = githubToken ? new Octokit({ auth: githubToken }) : null

  const calculateStats = useCallback((): TypingStats => {
    if (!startTime || !code) return { wpm: 0, accuracy: 0, errors: 0, correctChars: 0, totalChars: 0, time: 0 }

    const end = endTime || Date.now()
    const timeInMinutes = (end - startTime) / 1000 / 60
    const timeInSeconds = Math.round((end - startTime) / 1000)

    let correctChars = 0
    let errors = 0

    for (let i = 0; i < userInput.length; i++) {
      if (userInput[i] === code[i]) {
        correctChars++
      } else {
        errors++
      }
    }

    const accuracy = userInput.length > 0 ? Math.round((correctChars / userInput.length) * 100) : 100
    const wpm = timeInMinutes > 0 ? Math.round((correctChars / 5) / timeInMinutes) : 0

    return { wpm, accuracy, errors, correctChars, totalChars: userInput.length, time: timeInSeconds }
  }, [startTime, endTime, userInput, code])

  // Рекурсивное получение файлов из папки
  const fetchDirectoryContents = async (owner: string, repo: string, path: string): Promise<GitHubFile[]> => {
    const { data } = await octokit!.repos.getContent({ owner, repo, path })

    if (!Array.isArray(data)) {
      return []
    }

    const items: GitHubFile[] = []

    for (const item of data) {
      const fileItem: GitHubFile = {
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir'
      }

      // Если это папка, рекурсивно получаем её содержимое
      if (item.type === 'dir') {
        fileItem.children = await fetchDirectoryContents(owner, repo, item.path)
        fileItem.expanded = false
      }

      items.push(fileItem)
    }

    return items
  }

  // Сбор всех файлов в плоский список
  const collectAllFiles = (items: GitHubFile[], result: FlatFile[] = []): FlatFile[] => {
    for (const item of items) {
      if (item.type === 'file') {
        const ext = item.name.split('.').pop()?.toLowerCase()
        if (activeLanguage === 'all' || CODE_LANGUAGES.includes(ext || '')) {
          result.push({ name: item.name, path: item.path, type: 'file' })
        }
      } else if (item.children) {
        collectAllFiles(item.children, result)
      }
    }
    return result
  }

  const fetchRepoFiles = async () => {
    if (!octokit || !repoInput.trim()) return

    setIsLoading(true)
    setError('')

    try {
      const [owner, repo] = repoInput.split('/')
      if (!owner || !repo) {
        setError('Введите репозиторий в формате owner/repo')
        return
      }

      const rootFiles = await fetchDirectoryContents(owner, repo, '')
      setFiles(rootFiles)

      const allFiles = collectAllFiles(rootFiles)
      setFlatFiles(allFiles)
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке репозитория')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchFileContent = async (filePath: string) => {
    if (!octokit || !repoInput.trim()) return

    try {
      const [owner, repo] = repoInput.split('/')
      const { data } = await octokit.repos.getContent({ owner, repo, path: filePath })

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        setCode(content)
        setUserInput('')
        setStartTime(null)
        setEndTime(null)
        setShowResults(false)
        setSelectedFile(filePath)

        setTimeout(() => inputRef.current?.focus(), 100)
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке файла')
    }
  }

  const toggleFolder = (filePath: string) => {
    const toggleInTree = (items: GitHubFile[]): GitHubFile[] => {
      return items.map(item => {
        if (item.path === filePath) {
          return { ...item, expanded: !item.expanded }
        }
        if (item.children) {
          return { ...item, children: toggleInTree(item.children) }
        }
        return item
      })
    }

    setFiles(toggleInTree(files))
  }

  const handleInputFocus = () => {
    if (code && !showResults) {
      inputRef.current?.focus()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (!startTime && value.length > 0) {
      setStartTime(Date.now())
    }

    setUserInput(value.slice(0, code.length))

    if (value.length >= code.length) {
      setEndTime(Date.now())
      setTimeout(() => setShowResults(true), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  const restartTest = () => {
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setShowResults(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const selectNewCode = () => {
    setCode('')
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setShowResults(false)
    setSelectedFile('')
  }

  const saveToken = () => {
    localStorage.setItem('github_token', githubToken)
  }

  const stats = calculateStats()
  const progress = code ? (userInput.length / code.length) * 100 : 0

  const renderCodeDisplay = () => {
    if (!code) return null

    return code.split('').map((char, index) => {
      let className = 'char '

      if (index < userInput.length) {
        className += userInput[index] === char ? 'correct' : 'incorrect'
      } else if (index === userInput.length) {
        className += 'current'
      } else {
        className += 'pending'
      }

      const displayChar = char === '\n' ? '↵' : char === ' ' ? '·' : char === '\t' ? '→' : char

      return (
        <span key={index} className={className}>
          {displayChar}
        </span>
      )
    })
  }

  // Рендеринг дерева файлов
  const renderFileTree = (items: GitHubFile[], level: number = 0) => {
    return items.map(item => {
      const isSelected = selectedFile === item.path
      const paddingLeft = level * 16 + 8

      if (item.type === 'dir') {
        return (
          <div key={item.path}>
            <div
              className={`file-tree-item folder ${item.expanded ? 'expanded' : ''}`}
              style={{ paddingLeft }}
              onClick={() => toggleFolder(item.path)}
            >
              <span className="folder-icon">{item.expanded ? '📂' : '📁'}</span>
              <span className="file-name">{item.name}</span>
            </div>
            {item.expanded && item.children && (
              <div className="folder-children">
                {renderFileTree(item.children, level + 1)}
              </div>
            )}
          </div>
        )
      }

      return (
        <div
          key={item.path}
          className={`file-tree-item file ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft }}
          onClick={() => fetchFileContent(item.path)}
        >
          <span className="file-icon">📄</span>
          <span className="file-name">{item.name}</span>
        </div>
      )
    })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">GitType</div>
        <div>
          <input
            type="password"
            placeholder="GitHub Token"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            onBlur={saveToken}
            style={{
              background: 'var(--sub-color)',
              border: 'none',
              color: 'var(--text-color)',
              padding: '0.5rem',
              borderRadius: '4px',
              width: '200px'
            }}
          />
        </div>
      </header>

      <div className="main-content">
        {/* Левая панель - дерево файлов */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="github-input-small">
              <input
                type="text"
                placeholder="owner/repo"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRepoFiles()}
              />
              <button onClick={fetchRepoFiles} disabled={isLoading} className="btn-small">
                {isLoading ? '...' : '↻'}
              </button>
            </div>
          </div>

          <div className="file-tree">
            {files.length > 0 ? (
              renderFileTree(files)
            ) : (
              <div className="empty-tree">
                Введите репозиторий и нажмите ↻
              </div>
            )}
          </div>
        </aside>

        {/* Основная панель */}
        <main className="main-panel">
          <div className="config-section">
            <button
              className={`config-btn ${activeLanguage === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveLanguage('all'); fetchRepoFiles() }}
            >
              Все языки
            </button>
            {CODE_LANGUAGES.map(lang => (
              <button
                key={lang}
                className={`config-btn ${activeLanguage === lang ? 'active' : ''}`}
                onClick={() => { setActiveLanguage(lang); fetchRepoFiles() }}
              >
                {lang}
              </button>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          {code && (
            <>
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
                  <div className="stat-value">{stats.time}с</div>
                  <div className="stat-label">Время</div>
                </div>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}

          <div
            className="typing-area"
            onClick={handleInputFocus}
            ref={codeDisplayRef}
            tabIndex={0}
          >
            {code ? (
              <div className="code-display">
                {renderCodeDisplay()}
              </div>
            ) : (
              <div className="loading">
                Выберите файл из дерева слева для начала тренировки
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              className="hidden-input"
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!code}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          {code && !showResults && (
            <div className="restart-hint">
              Нажмите <strong>Tab</strong> для перезапуска или выберите другой файл
            </div>
          )}

          {showResults && (
            <div className="results-modal">
              <div className="results-content">
                <h2 className="results-title">🎉 Тренировка завершена!</h2>

                <div className="results-grid">
                  <div className="result-item">
                    <div className="result-value">{stats.wpm}</div>
                    <div className="result-label">WPM</div>
                  </div>
                  <div className="result-item">
                    <div className="result-value">{stats.accuracy}%</div>
                    <div className="result-label">Точность</div>
                  </div>
                  <div className="result-item">
                    <div className="result-value">{stats.errors}</div>
                    <div className="result-label">Ошибки</div>
                  </div>
                  <div className="result-item">
                    <div className="result-value">{stats.time}с</div>
                    <div className="result-label">Время</div>
                  </div>
                </div>

                <button className="restart-btn" onClick={restartTest}>
                  Повторить
                </button>

                <div style={{ marginTop: '1rem' }}>
                  <button
                    className="config-btn"
                    onClick={selectNewCode}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Выбрать другой код
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
