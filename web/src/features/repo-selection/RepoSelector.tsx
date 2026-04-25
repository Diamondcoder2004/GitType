import { useMemo, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import './RepoSelector.css'

const POPULAR_REPOS = [
  'microsoft/vscode',
  'facebook/react',
  'vuejs/core',
  'python/cpython',
  'rust-lang/rust',
  'golang/go',
]

interface RepoHistoryEntry {
  at: number
  repo: string
  wpm: number
}

function getRepoHistory(): RepoHistoryEntry[] {
  try {
    const raw = localStorage.getItem('gittype_session_history')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function RepoSelector() {
  const { token, setToken, selectedRepo, setSelectedRepo } = useAppStore(
    (state) => ({
      token: state.token,
      setToken: state.setToken,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
    }),
    shallow
  )
  const [repoInput, setRepoInput] = useState('')

  const repoProgress = useMemo(() => {
    if (!selectedRepo) return null
    const key = `${selectedRepo.owner}/${selectedRepo.repo}`
    const sessions = getRepoHistory().filter((entry) => entry.repo === key)
    if (!sessions.length) return null

    const avgWpm = Math.round(
      sessions.reduce((acc, entry) => acc + entry.wpm, 0) / sessions.length
    )
    const bestWpm = Math.max(...sessions.map((entry) => entry.wpm))

    return {
      sessions: sessions.length,
      avgWpm,
      bestWpm,
    }
  }, [selectedRepo])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [owner, repo] = repoInput.split('/')
    if (owner && repo) {
      setSelectedRepo(owner.trim(), repo.trim())
    }
  }

  const handleSaveToken = () => {
    localStorage.setItem('github_token', token)
  }

  const handlePopularRepoClick = (fullName: string) => {
    const [owner, repo] = fullName.split('/')
    setRepoInput(fullName)
    setSelectedRepo(owner, repo)
  }

  return (
    <div className="repo-selector">
      <div className="token-section">
        <input
          type="password"
          placeholder="GitHub Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onBlur={handleSaveToken}
          className="token-input"
        />
      </div>

      <form onSubmit={handleSubmit} className="repo-form">
        <input
          type="text"
          list="repo-suggestions"
          placeholder="owner/repo (например: almaz/GitType)"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          className="repo-input"
        />
        <datalist id="repo-suggestions">
          {POPULAR_REPOS.map((repo) => (
            <option key={repo} value={repo} />
          ))}
        </datalist>
        <button type="submit" className="submit-btn">
          Загрузить
        </button>
      </form>

      <div className="popular-list">
        <div className="popular-title">Популярные репозитории</div>
        <div className="popular-items">
          {POPULAR_REPOS.map((repo) => (
            <button
              key={repo}
              type="button"
              className="popular-btn"
              onClick={() => handlePopularRepoClick(repo)}
            >
              {repo}
            </button>
          ))}
        </div>
      </div>

      {selectedRepo && (
        <div className="selected-repo">
          Выбран: <strong>{selectedRepo.owner}/{selectedRepo.repo}</strong>
          {repoProgress && (
            <span className="repo-progress">
              Сессий: {repoProgress.sessions} · Avg WPM: {repoProgress.avgWpm} · Best WPM: {repoProgress.bestWpm}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
