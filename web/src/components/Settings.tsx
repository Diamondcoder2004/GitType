import { useState, useEffect, useCallback } from 'react'
import './Settings.css'

export interface AppSettings {
  theme: string
  fontSize: number
  soundEnabled: boolean
  smoothCaret: boolean
  bracketPairColorization: boolean
  indentationGuides: boolean
  showMinimap: boolean
  highlightNextChar: boolean
  githubToken: string
}

const THEMES = [
  { name: 'Серая (Default)', id: 'default', colors: { bg: '#323437', main: '#e2b714', text: '#d1d0c5' } },
  { name: 'Тёмная (Dracula)', id: 'dracula', colors: { bg: '#282a36', main: '#bd93f9', text: '#f8f8f2' } },
  { name: 'Матрица', id: 'matrix', colors: { bg: '#0d0208', main: '#00ff41', text: '#00ff41' } },
  { name: 'Светлая', id: 'light', colors: { bg: '#f0f0f0', main: '#007acc', text: '#333333' } },
  { name: 'Ночная', id: 'night', colors: { bg: '#1a1a2e', main: '#e94560', text: '#eaeaea' } },
  { name: 'Океан', id: 'ocean', colors: { bg: '#1b262c', main: '#64ffda', text: '#e6f1ff' } },
]

interface SettingsProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  onClose: () => void
}

export function Settings({ settings, onSettingsChange, onClose }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings)

  const handleThemeChange = (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId)
    if (!theme) return

    const newSettings = { ...localSettings, theme: themeId }
    setLocalSettings(newSettings)
    applyTheme(theme.colors)
    onSettingsChange(newSettings)
    // Авто-сохранение
    localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
    localStorage.setItem('gittype_theme', themeId)
  }

  const handleFontSizeChange = (size: number) => {
    const newSettings = { ...localSettings, fontSize: size }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
    localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
  }

  const handleSoundToggle = () => {
    const newSettings = { ...localSettings, soundEnabled: !localSettings.soundEnabled }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
    localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
  }

  const applyTheme = (colors: { bg: string; main: string; text: string }) => {
    const root = document.documentElement
    root.style.setProperty('--bg-color', colors.bg)
    root.style.setProperty('--main-color', colors.main)
    root.style.setProperty('--text-color', colors.text)
    root.style.setProperty('--sub-color', adjustColor(colors.bg, 30))
    root.style.setProperty('--caret-color', colors.main)
  }

  const adjustColor = (color: string, amount: number): string => {
    const hex = color.replace('#', '')
    const num = parseInt(hex, 16)
    const r = Math.min(255, Math.max(0, (num >> 16) + amount))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('gittype_theme')
    if (savedTheme) {
      const theme = THEMES.find(t => t.id === savedTheme)
      if (theme) {
        applyTheme(theme.colors)
        setLocalSettings({ ...localSettings, theme: savedTheme })
      }
    }
  }, [])

  // Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus trap
  useEffect(() => {
    const modal = document.querySelector('.settings-modal')
    if (!modal) return

    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return

    const firstFocusable = focusable[0] as HTMLElement
    const lastFocusable = focusable[focusable.length - 1] as HTMLElement

    firstFocusable.focus()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [])

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Настройки</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* GitHub Token */}
          <section className="settings-section">
            <h3>🔑 GitHub Token</h3>
            <div className="token-settings">
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={localSettings.githubToken || ''}
                onChange={(e) => {
                  const newSettings = { ...localSettings, githubToken: e.target.value }
                  setLocalSettings(newSettings)
                  onSettingsChange(newSettings)
                  localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
                  if (e.target.value) localStorage.setItem('github_token', e.target.value)
                }}
                className="token-settings-input"
              />
              <span className="token-settings-hint">
                {localSettings.githubToken ? '✓ Токен сохранён' : 'Нужен для доступа к GitHub API'}
              </span>
            </div>
          </section>

          {/* Темы */}
          <section className="settings-section">
            <h3>🎨 Тема оформления</h3>
            <div className="theme-grid">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  className={`theme-card ${localSettings.theme === theme.id ? 'active' : ''}`}
                  onClick={() => handleThemeChange(theme.id)}
                >
                  <div
                    className="theme-preview"
                    style={{
                      background: theme.colors.bg,
                      border: `2px solid ${theme.colors.main}`,
                    }}
                  >
                    <div
                      className="theme-dot"
                      style={{ background: theme.colors.main }}
                    />
                  </div>
                  <span className="theme-name">{theme.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Размер шрифта */}
          <section className="settings-section">
            <h3>📏 Размер шрифта</h3>
            <div className="font-size-control">
              <button
                className="size-btn"
                onClick={() => handleFontSizeChange(Math.max(12, localSettings.fontSize - 2))}
              >
                A-
              </button>
              <span className="size-value">{localSettings.fontSize}px</span>
              <button
                className="size-btn"
                onClick={() => handleFontSizeChange(Math.min(24, localSettings.fontSize + 2))}
              >
                A+
              </button>
            </div>
            <input
              type="range"
              min="12"
              max="24"
              step="2"
              value={localSettings.fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
              className="size-slider"
            />
          </section>

          {/* Звук */}
          <section className="settings-section">
            <h3>🔊 Звук кликов</h3>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={localSettings.soundEnabled}
                onChange={handleSoundToggle}
                className="toggle-checkbox"
              />
              <span className={`toggle-switch ${localSettings.soundEnabled ? 'on' : 'off'}`}>
                <span className="toggle-knob" />
              </span>
              <span className="toggle-text">
                {localSettings.soundEnabled ? 'Включено' : 'Выключено'}
              </span>
            </label>
          </section>

          {/* IDE-фишки */}
          <section className="settings-section">
            <h3>🛠️ IDE-фишки</h3>
            <div className="ide-features">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={localSettings.bracketPairColorization}
                  onChange={() => {
                    const newSettings = { ...localSettings, bracketPairColorization: !localSettings.bracketPairColorization }
                    setLocalSettings(newSettings)
                    onSettingsChange(newSettings)
                    localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
                  }}
                  className="toggle-checkbox"
                />
                <span className={`toggle-switch ${localSettings.bracketPairColorization ? 'on' : 'off'}`}>
                  <span className="toggle-knob" />
                </span>
                <span className="toggle-text">Подсветка парных скобок</span>
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={localSettings.indentationGuides}
                  onChange={() => {
                    const newSettings = { ...localSettings, indentationGuides: !localSettings.indentationGuides }
                    setLocalSettings(newSettings)
                    onSettingsChange(newSettings)
                    localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
                  }}
                  className="toggle-checkbox"
                />
                <span className={`toggle-switch ${localSettings.indentationGuides ? 'on' : 'off'}`}>
                  <span className="toggle-knob" />
                </span>
                <span className="toggle-text">Линии отступов</span>
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={localSettings.highlightNextChar}
                  onChange={() => {
                    const newSettings = { ...localSettings, highlightNextChar: !localSettings.highlightNextChar }
                    setLocalSettings(newSettings)
                    onSettingsChange(newSettings)
                    localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
                  }}
                  className="toggle-checkbox"
                />
                <span className={`toggle-switch ${localSettings.highlightNextChar ? 'on' : 'off'}`}>
                  <span className="toggle-knob" />
                </span>
                <span className="toggle-text">Подсветка следующего символа</span>
              </label>
            </div>
          </section>

          {/* Сохранение настроек — авто, только сброс */}
          <section className="settings-section">
            <h3>💾 Настройки сохраняются автоматически</h3>
            <div className="settings-actions">
              <button
                className="action-btn reset"
                onClick={() => {
                  const defaultSettings: AppSettings = {
                    theme: 'default',
                    fontSize: 16,
                    soundEnabled: false,
                    smoothCaret: true,
                    bracketPairColorization: false,
                    indentationGuides: false,
                    showMinimap: false,
                    highlightNextChar: false,
                    githubToken: '',
                  }
                  setLocalSettings(defaultSettings)
                  onSettingsChange(defaultSettings)
                  applyTheme(THEMES[0].colors)
                  localStorage.removeItem('gittype_settings')
                  localStorage.removeItem('gittype_theme')
                }}
              >
                🔄 Сбросить
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
