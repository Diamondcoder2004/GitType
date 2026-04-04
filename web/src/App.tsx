import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from './store/appStore'
import { githubClient } from './core/github/githubClient'
import { buildFileTree, filterTreeByExtension } from './core/repository/treeBuilder'
import { extractCodeBlocks, getRandomBlock } from './core/ast/blockExtractor'
import { RepoSelector, RepoSelectorLarge } from './features/repo-selection/RepoSelector'
import { FileTree } from './features/file-tree/FileTree'
import { Trainer } from './features/trainer/Trainer'
import { Settings, AppSettings } from './components/Settings'
import './App.css'

// Расширенный список языков — включая markdown, yaml, dockerfile, vue и др.
const CODE_LANGUAGES = [
  { id: 'all', label: 'Все' },
  { id: 'ts', label: 'TS' },
  { id: 'tsx', label: 'TSX' },
  { id: 'js', label: 'JS' },
  { id: 'jsx', label: 'JSX' },
  { id: 'py', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'rs', label: 'Rust' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'cs', label: 'C#' },
  { id: 'php', label: 'PHP' },
  { id: 'rb', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kt', label: 'Kotlin' },
  { id: 'md', label: 'Markdown' },
  { id: 'yaml', label: 'YAML' },
  { id: 'yml', label: 'YML' },
  { id: 'json', label: 'JSON' },
  { id: 'xml', label: 'XML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'sass', label: 'Sass' },
  { id: 'vue', label: 'Vue' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'sh', label: 'Shell' },
  { id: 'bash', label: 'Bash' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'sql', label: 'SQL' },
  { id: 'toml', label: 'TOML' },
  { id: 'ini', label: 'INI' },
  { id: 'lua', label: 'Lua' },
  { id: 'r', label: 'R' },
  { id: 'dart', label: 'Dart' },
]

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'default',
  fontSize: 16,
  soundEnabled: false,
  smoothCaret: true,
  bracketPairColorization: false,
  indentationGuides: false,
  showMinimap: false,
  highlightNextChar: false,
  githubToken: '',
  caretStyle: 'block',
  caretColor: 'theme',
  textStyle: 'normal',
}

function App() {
  const {
    token,
    selectedRepo,
    fileTree,
    selectedFile,
    fileContent,
    selectedBlock,
    languageFilter,
    view,
    setToken,
    setFileTree,
    setSelectedFile,
    setFileContent,
    setCodeBlocks,
    setSelectedBlock,
    setLanguageFilter,
    resetTrainer,
  } = useAppStore(
    useShallow((state) => ({
      token: state.token,
      selectedRepo: state.selectedRepo,
      fileTree: state.fileTree,
      selectedFile: state.selectedFile,
      fileContent: state.fileContent,
      selectedBlock: state.selectedBlock,
      languageFilter: state.languageFilter,
      view: state.view,
      setToken: state.setToken,
      setFileTree: state.setFileTree,
      setSelectedFile: state.setSelectedFile,
      setFileContent: state.setFileContent,
      setCodeBlocks: state.setCodeBlocks,
      setSelectedBlock: state.setSelectedBlock,
      setLanguageFilter: state.setLanguageFilter,
      resetTrainer: state.resetTrainer,
    }))
  )

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('gittype_settings')
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(200)
  const isResizingRef = useRef(false)

  // Авто-разворачиваем sidebar когда есть файлы
  useEffect(() => {
    if (fileTree.length > 0 && sidebarCollapsed) {
      setSidebarCollapsed(false)
    }
  }, [fileTree])

  // Загрузка сохранённых ширин
  useEffect(() => {
    const savedLeft = localStorage.getItem('gittype_left_sidebar_width')
    const savedRight = localStorage.getItem('gittype_right_sidebar_width')
    if (savedLeft) setLeftSidebarWidth(parseInt(savedLeft, 10))
    if (savedRight) setRightSidebarWidth(parseInt(savedRight, 10))
  }, [])

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return

      const target = (e.target as HTMLElement).dataset?.resizeTarget
      if (target === 'left') {
        const newWidth = Math.max(180, Math.min(600, e.clientX))
        setLeftSidebarWidth(newWidth)
        localStorage.setItem('gittype_left_sidebar_width', String(newWidth))
      } else if (target === 'right') {
        const vw = window.innerWidth
        const newWidth = Math.max(160, Math.min(400, vw - e.clientX))
        setRightSidebarWidth(newWidth)
        localStorage.setItem('gittype_right_sidebar_width', String(newWidth))
      }
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Инициализация токена
  useEffect(() => {
    const savedToken = localStorage.getItem('github_token')
    const envToken = import.meta.env.VITE_GITHUB_TOKEN
    if (savedToken && !token) {
      setToken(savedToken)
    } else if (envToken && !token) {
      setToken(envToken)
      localStorage.setItem('github_token', envToken)
    }
  }, [])

  useEffect(() => {
    if (token) githubClient.initialize(token)
  }, [token])

  // Загрузка дерева файлов
  useEffect(() => {
    if (!selectedRepo || !token) return
    const loadFileTree = async () => {
      try {
        const paths = await githubClient.getRepoTree(selectedRepo.owner, selectedRepo.repo, token)
        const tree = buildFileTree(paths)
        setFileTree(tree)
      } catch (error) {
        console.error('Error loading file tree:', error)
      }
    }
    loadFileTree()
  }, [selectedRepo?.owner, selectedRepo?.repo, token])

  // Загрузка содержимого файла
  useEffect(() => {
    if (!selectedFile || !selectedRepo || !token) return
    const loadFileContent = async () => {
      try {
        const content = await githubClient.getFileContent(
          selectedRepo.owner, selectedRepo.repo, selectedFile, token
        )
        setFileContent(content)
        const blocks = extractCodeBlocks(content, selectedFile)
        setCodeBlocks(blocks)
        const randomBlock = getRandomBlock(blocks)
        setSelectedBlock(randomBlock || null)
        resetTrainer()
      } catch (error) {
        console.error('Error loading file content:', error)
      }
    }
    loadFileContent()
  }, [selectedFile, selectedRepo?.owner, selectedRepo?.repo, token])

  // Фильтрация дерева
  const filteredTree = useMemo(
    () => (languageFilter !== 'all' ? filterTreeByExtension(fileTree, languageFilter) : fileTree),
    [languageFilter, fileTree]
  )

  const handleFileSelect = (path: string) => setSelectedFile(path)
  const handleLanguageChange = (lang: string) => setLanguageFilter(lang)

  // Следующий блок — для кнопки "Далее"
  const handleNextBlock = useCallback(() => {
    if (!fileContent || !selectedFile) return
    const blocks = extractCodeBlocks(fileContent, selectedFile)
    if (blocks.length === 0) return

    // Выбираем следующий блок после текущего
    const currentIndex = blocks.findIndex(b => b.id === selectedBlock?.id)
    const nextIndex = (currentIndex + 1) % blocks.length
    setSelectedBlock(blocks[nextIndex] || null)
    resetTrainer()
  }, [fileContent, selectedFile, selectedBlock, setSelectedBlock, resetTrainer])

  // Подсчёт файлов по языкам
  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const countFiles = (nodes: typeof fileTree) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          const ext = node.name.split('.').pop()?.toLowerCase()
          if (ext) counts[ext] = (counts[ext] || 0) + 1
        }
        if (node.children) countFiles(node.children)
      }
    }
    countFiles(fileTree)
    return counts
  }, [fileTree])

  // Активные языки (те, что есть в репозитории)
  const activeLanguages = useMemo(() => {
    return CODE_LANGUAGES.filter(lang => {
      if (lang.id === 'all') return true
      // Для dockerfile проверяем имя файла
      if (lang.id === 'dockerfile') return languageCounts['dockerfile'] > 0
      return languageCounts[lang.id] > 0
    })
  }, [languageCounts])

  return (
    <div className="app">
      {/* ===== HEADER ===== */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⌨️</span>
            <span className="logo-text">GitType</span>
          </div>
        </div>
        <div className="header-center">
          {selectedRepo ? (
            <div className="header-repo-badge">
              <span className="repo-badge-icon">📦</span>
              <span className="repo-badge-name">{selectedRepo.owner}/{selectedRepo.repo}</span>
            </div>
          ) : (
            <RepoSelector />
          )}
        </div>
        <div className="header-right">
          <button
            className="header-btn"
            onClick={() => setSettingsOpen(true)}
            title="Настройки"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="app-body">
        {/* ===== LEFT SIDEBAR ===== */}
        <aside
          className={`left-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
          style={!sidebarCollapsed ? { width: `${leftSidebarWidth}px` } : {}}
        >
          <div className="sidebar-header">
            <span className="sidebar-title">📁 Файлы</span>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          </div>
          {sidebarCollapsed ? (
            <div className="sidebar-collapsed-hint">
              <span>📁</span>
            </div>
          ) : (
            <div className="sidebar-content">
              <FileTree
                tree={filteredTree}
                selectedPath={selectedFile}
                onSelect={handleFileSelect}
              />
            </div>
          )}
          {/* Resize handle */}
          {!sidebarCollapsed && (
            <div
              className="resize-handle"
              data-resize-target="left"
              onMouseDown={() => {
                isResizingRef.current = true
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
              }}
            />
          )}
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="app-main">
          {!selectedRepo ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="welcome-icon">⌨️</div>
                <h1>GitType</h1>
                <p className="welcome-subtitle">Тренажёр слепой печати на реальном коде из GitHub</p>
                <RepoSelectorLarge />
                <div className="welcome-steps">
                  <div className="step">
                    <span className="step-number">1</span>
                    <span className="step-text">Введите токен и репозиторий выше</span>
                  </div>
                  <div className="step">
                    <span className="step-number">2</span>
                    <span className="step-text">Выберите файл из дерева слева</span>
                  </div>
                  <div className="step">
                    <span className="step-number">3</span>
                    <span className="step-text">Начните печатать!</span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedFile ? (
            <Trainer
              fontSize={settings.fontSize}
              onNextBlock={handleNextBlock}
              bracketPairColorization={settings.bracketPairColorization}
              indentationGuides={settings.indentationGuides}
              highlightNextChar={settings.highlightNextChar}
              caretStyle={settings.caretStyle}
              caretColor={settings.caretColor}
              textStyle={settings.textStyle}
            />
          ) : (
            <div className="no-file-screen">
              <div className="no-file-content">
                <div className="no-file-icon">📂</div>
                <h2>{selectedRepo.owner}/{selectedRepo.repo}</h2>
                <p>Выберите файл из дерева слева чтобы начать тренировку</p>
                {fileTree.length === 0 && (
                  <div className="loading-hint">Загрузка файлов...</div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ===== RIGHT SIDEBAR ===== */}
        <aside
          className="right-sidebar"
          style={{ width: `${rightSidebarWidth}px` }}
        >
          {/* Resize handle */}
          <div
            className="resize-handle resize-handle-left"
            data-resize-target="right"
            onMouseDown={() => {
              isResizingRef.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
          />
          <div className="right-sidebar-header">
            <span>📊 Языки</span>
          </div>
          <div className="language-list">
            {activeLanguages.map(lang => (
              <button
                key={lang.id}
                className={`lang-item ${languageFilter === lang.id ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.id)}
              >
                <span className="lang-label">{lang.label}</span>
                {lang.id !== 'all' && (
                  <span className="lang-count">{languageCounts[lang.id] || 0}</span>
                )}
              </button>
            ))}
          </div>

          {selectedFile && (
            <div className="file-info">
              <div className="file-info-header">📄 Файл</div>
              <div className="file-name" title={selectedFile}>
                {selectedFile.split('/').pop()}
              </div>
              <div className="file-path">{selectedFile}</div>
              {selectedBlock && (
                <div className="block-info">
                  <div className="block-tag">{selectedBlock.type}</div>
                  <div className="block-name">{selectedBlock.name}</div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ===== FOOTER REMOVED — hints moved to Trainer ===== */}

      {/* ===== SETTINGS MODAL ===== */}
      {settingsOpen && (
        <Settings
          settings={settings}
          onSettingsChange={(newSettings) => {
            setSettings(newSettings)
            localStorage.setItem('gittype_settings', JSON.stringify(newSettings))
            localStorage.setItem('gittype_theme', newSettings.theme)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

export default App
