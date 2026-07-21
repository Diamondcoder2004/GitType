import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from './store/appStore'
import { githubClient } from './core/github/githubClient'
import { buildFileTree, filterTreeByExtension, buildLearningPath } from './core/repository/treeBuilder'
import { extractCodeBlocks, getRandomBlock, extractImports, buildBlockTree, BlockTreeNode } from './core/ast/blockExtractor'
import { RepoSelector, RepoSelectorLarge } from './features/repo-selection/RepoSelector'
import { FileTree } from './features/file-tree/FileTree'
import { Trainer } from './features/trainer/Trainer'
import { Settings, AppSettings } from './components/Settings'
import { useBookStore } from './core/books/bookStore'
import { BookSelector } from './features/books/BookSelector'
import { BookTree } from './features/books/BookTree'
import { History } from './features/history/History'
import { CodeMap } from './features/codemap/CodeMap'
import { addSession } from './core/history/historyEngine'
import './App.css'

// Цвета тем для applyTheme (дубликат из Settings для доступа в App)
const THEME_COLORS: Record<string, { bg: string; main: string; text: string }> = {
  default: { bg: '#323437', main: '#e2b714', text: '#d1d0c5' },
  dracula: { bg: '#282a36', main: '#bd93f9', text: '#f8f8f2' },
  matrix: { bg: '#0d0208', main: '#00ff41', text: '#00ff41' },
  light: { bg: '#f0f0f0', main: '#007acc', text: '#333333' },
  night: { bg: '#1a1a2e', main: '#e94560', text: '#eaeaea' },
  ocean: { bg: '#1b262c', main: '#64ffda', text: '#e6f1ff' },
}

function applyTheme(colors: { bg: string; main: string; text: string }) {
  const root = document.documentElement
  root.style.setProperty('--bg-color', colors.bg)
  root.style.setProperty('--main-color', colors.main)
  root.style.setProperty('--text-color', colors.text)
  root.style.setProperty('--sub-color', adjustColor(colors.bg, 30))
  root.style.setProperty('--caret-color', colors.main)
}

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '')
  const num = parseInt(hex, 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

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
  strictMode: false,
  highlightCurrentLine: true,
  githubToken: '',
  caretStyle: 'block',
  caretColor: 'theme',
  textStyle: 'normal',
  autoTheme: false,
}

/** Вспомогательная функция для получения плоского списка из дерева файлов */
function flattenTree(tree: import('./core/repository/treeBuilder').TreeNode[]): import('./core/repository/treeBuilder').TreeNode[] {
  const result: import('./core/repository/treeBuilder').TreeNode[] = []
  for (const node of tree) {
    result.push(node)
    if (node.children) result.push(...flattenTree(node.children))
  }
  return result
}

const BLOCK_TYPE_ICONS: Record<string, string> = {
  function: '⚡',
  method: '🔧',
  class: '📦',
  interface: '🔷',
  type: '🔤',
}

/** Рекурсивный компонент для отображения иерархии блоков */
function BlockTreeItem({
  node,
  selectedBlock,
  expandedBlocks,
  completedBlocks,
  onSelect,
  onToggleExpand,
  depth = 0,
}: {
  node: BlockTreeNode
  selectedBlock: import('./core/ast/languageAdapter').CodeBlock | null
  expandedBlocks: Set<string>
  completedBlocks: string[]
  onSelect: (block: import('./core/ast/languageAdapter').CodeBlock) => void
  onToggleExpand: (id: string) => void
  depth?: number
}) {
  const { block, children } = node
  const hasChildren = children.length > 0
  const isExpanded = expandedBlocks.has(block.id)
  const isSelected = selectedBlock?.id === block.id
  const isDone = completedBlocks.includes(block.id)

  return (
    <div className="block-tree-node">
      <div
        className={`block-item ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: `${0.5 + depth * 1.2}rem` }}
      >
        {hasChildren && (
          <button
            className="block-expand-btn"
            onClick={() => onToggleExpand(block.id)}
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        )}
        {!hasChildren && <span className="block-indent-spacer" />}
        <button
          className="block-select-btn"
          onClick={() => onSelect(block)}
        >
          <span className="block-tag">{BLOCK_TYPE_ICONS[block.type] || '▪'} {block.type}</span>
          <span className="block-name" title={block.name}>{block.name}</span>
          {isDone && <span className="block-completed" title="Изучено">✅</span>}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="block-children">
          {children.map(child => (
            <BlockTreeItem
              key={child.block.id}
              node={child}
              selectedBlock={selectedBlock}
              expandedBlocks={expandedBlocks}
              completedBlocks={completedBlocks}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
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
    codeBlocks,
    setCodeBlocks,
    setSelectedBlock,
    setLanguageFilter,
    mode,
    setMode,
    progress,
    loadProgress,
    resetTrainer,
  } = useAppStore(
    useShallow((state) => ({
      token: state.token,
      selectedRepo: state.selectedRepo,
      fileTree: state.fileTree,
      selectedFile: state.selectedFile,
      fileContent: state.fileContent,
      codeBlocks: state.codeBlocks,
      selectedBlock: state.selectedBlock,
      languageFilter: state.languageFilter,
      view: state.view,
      mode: state.mode,
      progress: state.progress,
      setToken: state.setToken,
      setFileTree: state.setFileTree,
      setSelectedFile: state.setSelectedFile,
      setFileContent: state.setFileContent,
      setCodeBlocks: state.setCodeBlocks,
      setSelectedBlock: state.setSelectedBlock,
      setLanguageFilter: state.setLanguageFilter,
      setMode: state.setMode,
      loadProgress: state.loadProgress,
      resetTrainer: state.resetTrainer,
    }))
  )

  // Book module
  const selectedBook = useBookStore((s) => s.selectedBook)
  const bookChapters = useBookStore((s) => s.chapters)
  const bookCurrentChapter = useBookStore((s) => s.currentChapterId)
  const markChapterComplete = useBookStore((s) => s.markChapterComplete)
  const isComplete = useAppStore((s) => s.isComplete)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [codemapOpen, setCodemapOpen] = useState(false)
  const [treeMode, setTreeMode] = useState<'tree' | 'plan'>('tree')
  const [importPaths, setImportPaths] = useState<string[]>([])
  const [blockTree, setBlockTree] = useState<BlockTreeNode[]>([])
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('gittype_settings')
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // prefers-color-scheme: автоопределение темы
  useEffect(() => {
    if (!settings.autoTheme) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const themeId = e.matches ? 'default' : 'light'
      const colors = THEME_COLORS[themeId]
      if (colors) {
        applyTheme(colors)
        // Обновляем тему в настройках, чтобы UI был консистентным
        setSettings(prev => ({ ...prev, theme: themeId }))
      }
    }

    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange as (e: MediaQueryListEvent) => void)
    return () => mediaQuery.removeEventListener('change', handleChange as (e: MediaQueryListEvent) => void)
  }, [settings.autoTheme])
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(200)
  const [isResizing, setIsResizing] = useState(false)
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
      } else if (target === 'right') {
        const vw = window.innerWidth
        const newWidth = Math.max(160, Math.min(400, vw - e.clientX))
        setRightSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Сохраняем после завершения
      localStorage.setItem('gittype_left_sidebar_width', String(leftSidebarWidth))
      localStorage.setItem('gittype_right_sidebar_width', String(rightSidebarWidth))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [leftSidebarWidth, rightSidebarWidth])

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

  // Загрузка прогресса
  useEffect(() => {
    if (selectedRepo) {
      loadProgress(selectedRepo.owner, selectedRepo.repo)
    }
  }, [selectedRepo, loadProgress])

  // Когда тренировка завершена — отмечаем главу книги
  useEffect(() => {
    if (isComplete && selectedBook && bookCurrentChapter) {
      markChapterComplete(bookCurrentChapter)
    }
  }, [isComplete, selectedBook, bookCurrentChapter, markChapterComplete])

  // Сохраняем результат в историю при завершении тренировки
  const stats = useAppStore((s) => s.stats)
  useEffect(() => {
    if (isComplete && stats && selectedFile) {
      const repoName = selectedRepo ? `${selectedRepo.owner}/${selectedRepo.repo}` : undefined
      const blockName = mode === 'code-block' && selectedBlock ? selectedBlock.name : undefined
      addSession(stats, mode, selectedFile, blockName, repoName)
    }
  }, [isComplete])

  // Авто-разворачиваем sidebar когда выбрана книга
  useEffect(() => {
    if (selectedBook && sidebarCollapsed) {
      setSidebarCollapsed(false)
    }
  }, [selectedBook])

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
        const tree = buildBlockTree(blocks)
        setBlockTree(tree)
        // Авто-раскрываем классы при загрузке
        const classIds = new Set(blocks.filter(b => b.type === 'class').map(b => b.id))
        setExpandedBlocks(classIds)
        const imps = extractImports(content, selectedFile)
        setImportPaths(imps)
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

  // План обучения
  const learningPlan = useMemo(() => {
    return buildLearningPath(filteredTree)
  }, [filteredTree])

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

  // Предыдущий блок
  const handlePrevBlock = useCallback(() => {
    if (!fileContent || !selectedFile) return
    const blocks = extractCodeBlocks(fileContent, selectedFile)
    if (blocks.length === 0) return

    const currentIndex = blocks.findIndex(b => b.id === selectedBlock?.id)
    const prevIndex = (currentIndex - 1 + blocks.length) % blocks.length
    setSelectedBlock(blocks[prevIndex] || null)
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
            onClick={() => setCodemapOpen(true)}
            title="CodeMap — карта прогресса"
          >
            🗺️
          </button>
          <button
            className="header-btn"
            onClick={() => setHistoryOpen(true)}
            title="История"
          >
            📊
          </button>
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
            <div className="sidebar-tabs">
              {!selectedBook ? (
                <>
                  <button
                    className={`sidebar-tab ${treeMode === 'tree' ? 'active' : ''}`}
                    onClick={() => setTreeMode('tree')}
                  >
                    📁 Файлы
                  </button>
                  <button
                    className={`sidebar-tab ${treeMode === 'plan' ? 'active' : ''}`}
                    onClick={() => setTreeMode('plan')}
                  >
                    🛣️ План
                  </button>
                </>
              ) : (
                <span className="sidebar-tab active">📖 Книга</span>
              )}
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          </div>
          {selectedBook && bookChapters.length > 0 ? (
            // === BOOK MODE ===
            sidebarCollapsed ? (
              <div className="sidebar-collapsed-hint">
                <span>📖</span>
              </div>
            ) : (
              <div className="sidebar-content">
                <BookTree />
              </div>
            )
          ) : (
            // === REPO MODE (original) ===
            sidebarCollapsed ? (
              <div className="sidebar-collapsed-hint">
                <span>{treeMode === 'tree' ? '📁' : '🛣️'}</span>
              </div>
            ) : (
              <div className="sidebar-content">
                {treeMode === 'tree' ? (
                  <FileTree
                    tree={filteredTree}
                    selectedPath={selectedFile}
                    onSelect={handleFileSelect}
                    completedFiles={progress.completedFiles}
                  />
                ) : (
                  <div className="learning-plan">
                    {learningPlan.map((node, index) => (
                      <button
                        key={node.path}
                        className={`plan-item ${selectedFile === node.path ? 'active' : ''}`}
                        onClick={() => handleFileSelect(node.path)}
                      >
                        <span className="plan-step">{index + 1}.</span>
                        <div className="plan-text">
                          <span className="plan-name">{node.name}</span>
                          <span className="plan-path">{node.path.split('/').slice(0, -1).join('/')}</span>
                        </div>
                        {progress.completedFiles.includes(node.path) && (
                          <span className="plan-completed" title="Изучено">✅</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          {/* Resize handle */}
          {!sidebarCollapsed && (
            <div
              className="resize-handle"
              data-resize-target="left"
              onMouseDown={() => {
                isResizingRef.current = true
                setIsResizing(true)
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
              }}
            />
          )}
        </aside>

        {/* ===== MAIN CONTENT — view-based switching ===== */}
        <main className="app-main">
          {view === 'repo-select' && (
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
          )}

          {view === 'book-select' && <BookSelector />}

          {view === 'trainer' && (
            selectedFile ? (
              <Trainer
                fontSize={settings.fontSize}
                onNextBlock={handleNextBlock}
                onPrevBlock={handlePrevBlock}
                bracketPairColorization={settings.bracketPairColorization}
                indentationGuides={settings.indentationGuides}
                highlightNextChar={settings.highlightNextChar}
                caretStyle={settings.caretStyle}
                caretColor={settings.caretColor}
                textStyle={settings.textStyle}
                strictMode={settings.strictMode}
                highlightCurrentLine={settings.highlightCurrentLine}
                soundEnabled={settings.soundEnabled}
                showMinimap={settings.showMinimap}
              />
            ) : (
              <div className="no-file-screen">
                <div className="no-file-content">
                  <div className="no-file-icon">📂</div>
                  <h2>Выберите главу</h2>
                  <p>Выберите главу из оглавления книги или файл из репозитория</p>
                </div>
              </div>
            )
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
              setIsResizing(true)
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

          {codeBlocks.length > 0 && mode === 'code-block' && (
            <>
              <div className="right-sidebar-header">
                <span>🧩 Блоки ({codeBlocks.length})</span>
              </div>
              <div className="block-list">
                {blockTree.map(node => (
                  <BlockTreeItem
                    key={node.block.id}
                    node={node}
                    selectedBlock={selectedBlock}
                    expandedBlocks={expandedBlocks}
                    completedBlocks={progress.completedBlocks}
                    onSelect={(block) => { setSelectedBlock(block); resetTrainer() }}
                    onToggleExpand={(id) => setExpandedBlocks(prev => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })}
                  />
                ))}
              </div>
            </>
          )}

          {importPaths.length > 0 && mode === 'code-block' && (
            <>
              <div className="right-sidebar-header">
                <span>🔗 Импорты ({importPaths.length})</span>
              </div>
              <div className="import-list">
                {importPaths.map(imp => {
                  // Ищем совпадающий файл в дереве
                  const candidates = [imp, imp + '.ts', imp + '.tsx', imp + '.js', imp + '.jsx', imp + '.py']
                  const matchedFile = flattenTree(fileTree).find(n =>
                    candidates.some(c => n.path === c || n.path.endsWith('/' + c.split('/').pop()))
                  )
                  return (
                    <button
                      key={imp}
                      className={`import-item ${matchedFile && selectedFile === matchedFile.path ? 'active' : ''} ${matchedFile ? 'resolved' : 'unresolved'}`}
                      onClick={() => matchedFile && handleFileSelect(matchedFile.path)}
                      title={matchedFile ? matchedFile.path : `Внешний модуль: ${imp}`}
                    >
                      <span className="import-icon">{matchedFile ? '📄' : '📦'}</span>
                      <span className="import-name">{imp.split('/').pop()}</span>
                      {matchedFile && progress.completedFiles.includes(matchedFile.path) && (
                        <span className="import-done">✅</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

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

      {/* ===== RESIZE OVERLAY ===== */}
      {isResizing && <div className="resize-overlay" />}

      {/* ===== CODEMAP MODAL ===== */}
      {codemapOpen && (
        <CodeMap
          onClose={() => setCodemapOpen(false)}
          onFileSelect={handleFileSelect}
        />
      )}

      {/* ===== HISTORY MODAL ===== */}
      {historyOpen && (
        <History onClose={() => setHistoryOpen(false)} />
      )}

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
