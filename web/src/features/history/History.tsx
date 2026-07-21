import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  loadHistory,
  getPersonalBests,
  getAverageStats,
  filterByMode,
  groupByDay,
  clearHistory,
  exportHistory,
  formatDate,
  SessionRecord,
} from '../../core/history/historyEngine'
import '../../components/History.css'

interface HistoryProps {
  onClose: () => void
}

export function History({ onClose }: HistoryProps) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [modeFilter, setModeFilter] = useState<'all' | 'full-file' | 'code-block'>('all')

  useEffect(() => {
    setSessions(loadHistory())
  }, [])

  // Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const filtered = useMemo(() => filterByMode(sessions, modeFilter), [sessions, modeFilter])
  const personalBests = useMemo(() => getPersonalBests(filtered), [filtered])
  const avgStats = useMemo(() => getAverageStats(filtered, 10), [filtered])
  const dailyData = useMemo(() => groupByDay(filtered), [filtered])

  // Определяем, является ли сессия персональным рекордом WPM
  const bestWpmId = useMemo(() => {
    if (filtered.length === 0) return null
    let best = filtered[0]
    for (const s of filtered) {
      if (s.wpm > best.wpm) best = s
    }
    return best.id
  }, [filtered])

  const handleClear = useCallback(() => {
    if (window.confirm('Удалить всю историю? Это действие нельзя отменить.')) {
      clearHistory()
      setSessions([])
    }
  }, [])

  const handleExport = useCallback(() => {
    const data = exportHistory()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gittype-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Максимальный WPM для масштабирования графика
  const maxWpm = useMemo(() => {
    if (dailyData.length === 0) return 100
    return Math.max(...dailyData.map((d) => d.avgWpm), 50)
  }, [dailyData])

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2>📊 История</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="history-content">
          {/* Фильтры и действия */}
          <div className="history-controls">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${modeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setModeFilter('all')}
              >
                Все
              </button>
              <button
                className={`filter-btn ${modeFilter === 'full-file' ? 'active' : ''}`}
                onClick={() => setModeFilter('full-file')}
              >
                Файлы
              </button>
              <button
                className={`filter-btn ${modeFilter === 'code-block' ? 'active' : ''}`}
                onClick={() => setModeFilter('code-block')}
              >
                Блоки
              </button>
            </div>
            <div className="action-buttons">
              <button className="action-btn export" onClick={handleExport}>
                📥 Экспорт
              </button>
              <button className="action-btn clear" onClick={handleClear}>
                🗑️ Очистить
              </button>
            </div>
          </div>

          {/* Персональные рекорды */}
          <section className="pbs-section">
            <h3>🏆 Персональные рекорды</h3>
            <div className="pbs-grid">
              {sessions.length > 0 ? (
                <>
                  <div className="pb-card">
                    <div className="pb-mode">Лучший WPM</div>
                    <div className="pb-value">{personalBests.bestWpm}</div>
                    <div className="pb-label">слов/мин</div>
                  </div>
                  <div className="pb-card">
                    <div className="pb-mode">Лучший CPM</div>
                    <div className="pb-value">{personalBests.bestCpm}</div>
                    <div className="pb-label">симв/мин</div>
                  </div>
                  <div className="pb-card">
                    <div className="pb-mode">Точность</div>
                    <div className="pb-value">{personalBests.bestAccuracy}%</div>
                    <div className="pb-label">максимум</div>
                  </div>
                  <div className="pb-card">
                    <div className="pb-mode">Среднее (10)</div>
                    <div className="pb-value">{avgStats.avgWpm}</div>
                    <div className="pb-label">wpm</div>
                  </div>
                  <div className="pb-card">
                    <div className="pb-mode">Всего сессий</div>
                    <div className="pb-value">{sessions.length}</div>
                    <div className="pb-label">тренировок</div>
                  </div>
                </>
              ) : (
                <div className="no-pbs">
                  Начните тренироваться — рекорды появятся здесь
                </div>
              )}
            </div>
          </section>

          {/* Мини-график прогресса по дням */}
          {dailyData.length > 1 && (
            <section className="pbs-section">
              <h3>📈 Прогресс по дням</h3>
              <div className="chart-container">
                <div className="chart-bars">
                  {dailyData.slice(-14).map((day) => (
                    <div
                      key={day.date}
                      className="chart-bar-wrapper"
                      title={`${day.date}: ${day.avgWpm} WPM, ${day.avgAccuracy}% acc (${day.sessions} сессий)`}
                    >
                      <div
                        className="chart-bar"
                        style={{
                          height: `${Math.max(4, (day.avgWpm / maxWpm) * 100)}%`,
                        }}
                      />
                      <div className="chart-label">
                        {day.date.slice(5)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Список сессий */}
          <section className="history-list-section">
            <h3>📋 Последние сессии ({filtered.length})</h3>
            {filtered.length > 0 ? (
              <div className="history-list">
                {[...filtered]
                  .reverse()
                  .slice(0, 50)
                  .map((session) => (
                    <div key={session.id} className="history-item">
                      <div className="history-main">
                        <span className="history-wpm">{session.wpm}</span>
                        <div className="history-details">
                          <span className="history-mode">
                            {session.mode === 'full-file' ? '📄' : '🧩'}{' '}
                            {session.blockName || session.filePath.split('/').pop()}
                          </span>
                          <span className="history-accuracy">{session.accuracy}%</span>
                          <span className="history-errors">{session.errors} err</span>
                        </div>
                      </div>
                      <div className="history-secondary">
                        <div className="history-stats">
                          <span>{session.cpm} cpm</span>
                          <span>{session.duration}s</span>
                        </div>
                        <span className="history-date">{formatDate(session.timestamp)}</span>
                      </div>
                      {session.id === bestWpmId && (
                        <span className="pb-badge">PB</span>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="no-history">
                <p>🎯 Нет записей</p>
                <p>Завершите тренировку, чтобы она появилась здесь</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
