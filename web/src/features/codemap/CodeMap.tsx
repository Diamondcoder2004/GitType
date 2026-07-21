import { useState, useEffect, useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { loadHistory } from '../../core/history/historyEngine'
import {
  buildProgressMap,
  getMapOverview,
  getFileIcon,
  StarRating,
  DirectoryProgress,
} from '../../core/codemap/codeMapEngine'
import './CodeMap.css'

interface CodeMapProps {
  onClose: () => void
  onFileSelect: (filePath: string) => void
}

function Stars({ count }: { count: StarRating }) {
  return (
    <span className="file-stars">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= count ? 'star-filled' : 'star-empty'}>
          {i <= count ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

export function CodeMap({ onClose, onFileSelect }: CodeMapProps) {
  const { fileTree, selectedFile, progress } = useAppStore(
    useShallow((state) => ({
      fileTree: state.fileTree,
      selectedFile: state.selectedFile,
      progress: state.progress,
    }))
  )

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [sessions] = useState(() => loadHistory())

  // Строим карту прогресса
  const directories = useMemo(
    () => buildProgressMap(fileTree, sessions, progress.completedFiles),
    [fileTree, sessions, progress.completedFiles]
  )

  const overview = useMemo(() => getMapOverview(directories), [directories])

  // Авто-раскрываем директории с прогрессом
  useEffect(() => {
    const withProgress = directories
      .filter((d) => d.completedFiles > 0)
      .map((d) => d.path)
    // Также раскрываем директорию текущего файла
    if (selectedFile) {
      const parts = selectedFile.split('/')
      if (parts.length > 1) {
        withProgress.push(parts.slice(0, -1).join('/'))
      }
    }
    if (withProgress.length > 0) {
      setExpandedDirs(new Set(withProgress))
    }
  }, [directories, selectedFile])

  // Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const toggleDir = useCallback((dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }, [])

  const handleFileClick = useCallback(
    (filePath: string) => {
      onFileSelect(filePath)
      onClose()
    },
    [onFileSelect, onClose]
  )

  if (fileTree.length === 0) {
    return (
      <div className="codemap-overlay" onClick={onClose}>
        <div className="codemap-modal" onClick={(e) => e.stopPropagation()}>
          <div className="codemap-header">
            <h2>🗺️ CodeMap</h2>
            <button className="codemap-close" onClick={onClose}>✕</button>
          </div>
          <div className="codemap-empty">
            <div className="codemap-empty-icon">🗺️</div>
            <h3>Карта пуста</h3>
            <p>Выберите репозиторий, чтобы увидеть карту прогресса</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="codemap-overlay" onClick={onClose}>
      <div className="codemap-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="codemap-header">
          <h2>🗺️ CodeMap</h2>
          <button className="codemap-close" onClick={onClose}>✕</button>
        </div>

        {/* Overview Stats */}
        <div className="codemap-overview">
          <div className="overview-card">
            <div className="overview-value">{overview.completedFiles}/{overview.totalFiles}</div>
            <div className="overview-label">файлов</div>
          </div>
          <div className="overview-card">
            <div className="overview-value">{overview.completionPercent}%</div>
            <div className="overview-label">прогресс</div>
          </div>
          <div className="overview-card">
            <div className="overview-value">
              {overview.totalStars}<span style={{ opacity: 0.4 }}>/{overview.maxPossibleStars}</span>
            </div>
            <div className="overview-label">звёзд</div>
          </div>
          <div className="overview-card">
            <div className="overview-value">{overview.avgWpm || '—'}</div>
            <div className="overview-label">сред. wpm</div>
          </div>
          <div className="overview-card">
            <div className="overview-value">{overview.avgAccuracy ? `${overview.avgAccuracy}%` : '—'}</div>
            <div className="overview-label">сред. acc</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="codemap-progress-section">
          <div className="codemap-progress-bar">
            <div
              className="codemap-progress-fill"
              style={{ width: `${overview.completionPercent}%` }}
            />
          </div>
          <div className="codemap-progress-text">
            <span>{overview.completedFiles} из {overview.totalFiles} файлов пройдено</span>
            <span>⭐ {overview.totalStars} звёзд</span>
          </div>
        </div>

        {/* Directory Map */}
        <div className="codemap-content">
          {directories.map((dir) => (
            <DirectorySection
              key={dir.path}
              dir={dir}
              isExpanded={expandedDirs.has(dir.path)}
              selectedFile={selectedFile}
              onToggle={() => toggleDir(dir.path)}
              onFileClick={handleFileClick}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="codemap-legend">
          <div className="legend-item">
            <span className="legend-stars">☆☆☆</span>
            <span>Не начато</span>
          </div>
          <div className="legend-item">
            <span className="legend-stars">★☆☆</span>
            <span>Завершено</span>
          </div>
          <div className="legend-item">
            <span className="legend-stars">★★☆</span>
            <span>Хорошо</span>
          </div>
          <div className="legend-item">
            <span className="legend-stars">★★★</span>
            <span>Отлично</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Секция директории */
function DirectorySection({
  dir,
  isExpanded,
  selectedFile,
  onToggle,
  onFileClick,
}: {
  dir: DirectoryProgress
  isExpanded: boolean
  selectedFile: string | null
  onToggle: () => void
  onFileClick: (path: string) => void
}) {
  return (
    <div className="dir-section">
      <div className="dir-header" onClick={onToggle}>
        <span className={`dir-toggle ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <span className="dir-name">📁 {dir.name}</span>
        <div className="dir-badge">
          <div className="dir-mini-bar">
            <div
              className="dir-mini-fill"
              style={{ width: `${dir.completionPercent}%` }}
            />
          </div>
          <span className="dir-completion">
            {dir.completedFiles}/{dir.totalFiles}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="file-grid">
          {dir.files.map((file) => (
            <div
              key={file.filePath}
              className={`file-card ${
                file.isCompleted ? 'completed' : 'not-started'
              } ${file.stars === 3 ? 'stars-3' : ''} ${
                selectedFile === file.filePath ? 'active' : ''
              }`}
              onClick={() => onFileClick(file.filePath)}
              title={
                file.isCompleted
                  ? `${file.bestWpm} WPM · ${file.bestAccuracy}% · ${file.sessions} сессий`
                  : 'Не начато'
              }
            >
              <div className="file-card-top">
                <span className="file-icon">{getFileIcon(file.extension)}</span>
                <span className="file-card-name">{file.fileName}</span>
              </div>

              <Stars count={file.stars} />

              {file.isCompleted && file.bestWpm > 0 && (
                <div className="file-card-stats">
                  <span className="file-stat wpm">{file.bestWpm} wpm</span>
                  <span className="file-stat">{file.bestAccuracy}%</span>
                  {file.sessions > 1 && (
                    <span className="file-sessions">×{file.sessions}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
