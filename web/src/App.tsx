import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { githubClient } from './core/github/githubClient'
import { buildFileTree, filterTreeByExtension } from './core/repository/treeBuilder'
import { extractCodeBlocks, getRandomBlock } from './core/ast/blockExtractor'
import { RepoSelector } from './features/repo-selection/RepoSelector'
import { FileTree } from './features/file-tree/FileTree'
import { Trainer } from './features/trainer/Trainer'
import './App.css'

const CODE_LANGUAGES = [
  'all',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'java',
  'go',
  'rs',
  'cpp',
  'c',
  'cs',
  'php',
  'rb',
  'swift',
  'kt',
]

function App() {
  const {
    token,
    selectedRepo,
    fileTree,
    selectedFile,
    fileContent,
    selectedBlock,
    languageFilter,
    setToken,
    setFileTree,
    setSelectedFile,
    setFileContent,
    setCodeBlocks,
    setSelectedBlock,
    setLanguageFilter,
    resetTrainer,
  } = useAppStore()

  // Инициализация токена при загрузке
  useEffect(() => {
    const savedToken = localStorage.getItem('github_token')
    const envToken = import.meta.env.VITE_GITHUB_TOKEN
    
    if (savedToken) {
      setToken(savedToken)
    } else if (envToken) {
      setToken(envToken)
      localStorage.setItem('github_token', envToken)
    }
  }, [])

  // Инициализация GitHub клиента при загрузке токена
  useEffect(() => {
    if (token) {
      githubClient.initialize(token)
    }
  }, [token])

  // Загрузка дерева файлов при выборе репозитория
  useEffect(() => {
    if (!selectedRepo || !token) return

    const loadFileTree = async () => {
      try {
        const paths = await githubClient.getRepoTree(
          selectedRepo.owner,
          selectedRepo.repo,
          token
        )
        const tree = buildFileTree(paths)
        setFileTree(tree)
      } catch (error) {
        console.error('Error loading file tree:', error)
      }
    }

    loadFileTree()
  }, [selectedRepo, token, setFileTree])

  // Загрузка содержимого файла при выборе
  useEffect(() => {
    if (!selectedFile || !selectedRepo || !token) return

    const loadFileContent = async () => {
      try {
        const content = await githubClient.getFileContent(
          selectedRepo.owner,
          selectedRepo.repo,
          selectedFile,
          token
        )
        console.log('File content loaded:', content.substring(0, 100) + '...')
        setFileContent(content)

        // Извлекаем блоки кода
        const blocks = extractCodeBlocks(content, selectedFile)
        console.log('Extracted blocks:', blocks)
        setCodeBlocks(blocks)

        // Выбираем случайный блок
        const randomBlock = getRandomBlock(blocks)
        setSelectedBlock(randomBlock || null)

        resetTrainer()
      } catch (error) {
        console.error('Error loading file content:', error)
      }
    }

    loadFileContent()
  }, [selectedFile, selectedRepo, token, setFileContent, setCodeBlocks, setSelectedBlock, resetTrainer])

  // Фильтрация дерева по языку
  const filteredTree = languageFilter !== 'all'
    ? filterTreeByExtension(fileTree, languageFilter)
    : fileTree

  const handleFileSelect = (path: string) => {
    setSelectedFile(path)
  }

  const handleLanguageChange = (lang: string) => {
    setLanguageFilter(lang)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">GitType</div>
        <RepoSelector />
      </header>

      <div className="language-filter">
        {CODE_LANGUAGES.map((lang) => (
          <button
            key={lang}
            className={`lang-btn ${languageFilter === lang ? 'active' : ''}`}
            onClick={() => handleLanguageChange(lang)}
          >
            {lang}
          </button>
        ))}
      </div>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-header">Файлы</div>
          <FileTree
            tree={filteredTree}
            selectedPath={selectedFile}
            onSelect={handleFileSelect}
          />
        </aside>

        <main className="main-panel">
          {selectedBlock ? (
            <Trainer />
          ) : (
            <div className="no-block">
              {fileContent
                ? 'В файле не найдено блоков кода для тренировки'
                : 'Выберите файл из дерева слева'}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
