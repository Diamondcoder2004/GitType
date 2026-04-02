import { useState, useEffect } from 'react'
import './Settings.css'

export interface AppSettings {
  theme: string
  fontSize: number
  soundEnabled: boolean
  smoothCaret: boolean
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
  }

  const handleFontSizeChange = (size: number) => {
    const newSettings = { ...localSettings, fontSize: size }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  const handleSoundToggle = () => {
    const newSettings = { ...localSettings, soundEnabled: !localSettings.soundEnabled }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
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

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Настройки</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
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

          {/* Сохранение настроек */}
          <section className="settings-section">
            <h3>💾 Управление настройками</h3>
            <div className="settings-actions">
              <button
                className="action-btn export"
                onClick={() => {
                  const data = JSON.stringify(localSettings, null, 2)
                  localStorage.setItem('gittype_settings', data)
                  localStorage.setItem('gittype_theme', localSettings.theme)
                  alert('Настройки сохранены!')
                }}
              >
                💾 Сохранить
              </button>
              <button
                className="action-btn reset"
                onClick={() => {
                  const defaultSettings: AppSettings = {
                    theme: 'default',
                    fontSize: 16,
                    soundEnabled: true,
                    smoothCaret: true,
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
