import { useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { useAppStore } from '../../store/appStore'
import { processTyping } from '../../core/typing/typingEngine'
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

  const editorRef = useRef<any>(null)

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor

    editor.onDidChangeModelContent(() => {
      const value = editor.getValue()
      const target = mode === 'full-file' 
        ? fileContent || ''
        : selectedBlock?.code || ''

      if (!startTime && value.length > 0) {
        setStartTime(Date.now())
      }

      const result = processTyping(target, value)
      setUserInput(value)

      if (result.completed && !isComplete) {
        setEndTime(Date.now())
        setIsComplete(true)

        const finalStats = calculateStats(
          startTime || Date.now(),
          Date.now(),
          value.length,
          result.correctChars,
          result.errors
        )
        setStats(finalStats)
      }
    })
  }

  const handleModeToggle = () => {
    setMode(mode === 'full-file' ? 'code-block' : 'full-file')
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setStats(null)
    setIsComplete(false)
  }

  // В режиме full-file показываем весь файл, в режиме code-block - выбранный блок
  const displayContent = mode === 'full-file'
    ? fileContent || ''
    : selectedBlock?.code || ''

  const targetContent = displayContent

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
          {mode === 'code-block' && (
            <button onClick={handleModeToggle} className="mode-btn">
              🎲 Случайный блок
            </button>
          )}
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

      <div className="editor-container">
        <Editor
          height="500px"
          language={getMonacoLanguage(selectedFile)}
          value={displayContent}
          onChange={(value) => {
            if (!startTime && value && value.length > 0) {
              setStartTime(Date.now())
            }
            setUserInput(value || '')
          }}
          onMount={handleEditorMount}
          options={{
            readOnly: false,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            folding: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            theme: 'vs-dark',
          }}
        />
      </div>

      {isComplete && (
        <div className="complete-message">
          🎉 Тренировка завершена!
        </div>
      )}

      {!displayContent && (
        <div className="no-block">
          Выберите файл для начала тренировки
        </div>
      )}
    </div>
  )
}
