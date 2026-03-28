import { useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { useAppStore } from '../../store/appStore'
import { processTyping } from '../../core/typing/typingEngine'
import { calculateStats } from '../../core/typing/statsEngine'
import './Trainer.css'

export function Trainer() {
  const {
    mode,
    selectedBlock,
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
      const target = mode === 'implement' 
        ? selectedBlock?.body || '' 
        : selectedBlock?.code || ''

      if (!startTime) {
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
    setMode(mode === 'full-block' ? 'implement' : 'full-block')
    setUserInput('')
    setStartTime(null)
    setEndTime(null)
    setStats(null)
    setIsComplete(false)
  }

  const displayContent = mode === 'implement' && selectedBlock
    ? `${selectedBlock.signature}\n  // TODO: Implement this function\n}`
    : selectedBlock?.code || ''

  return (
    <div className="trainer">
      <div className="trainer-header">
        <div className="block-info">
          {selectedBlock && (
            <>
              <span className="block-type">{selectedBlock.type}</span>
              <span className="block-name">{selectedBlock.name}</span>
              <span className="block-complexity">
                Сложность: {selectedBlock.complexity}
              </span>
            </>
          )}
        </div>

        <div className="trainer-controls">
          <button onClick={handleModeToggle} className="mode-btn">
            {mode === 'full-block' ? 'Full Block' : 'Implement'}
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

      <div className="editor-container">
        <Editor
          height="400px"
          language="typescript"
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
            lineNumbers: 'off',
            folding: false,
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
    </div>
  )
}
