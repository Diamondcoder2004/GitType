import { useState, useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import './RepoSelector.css'

export function RepoSelector() {
  const { token, setToken, selectedRepo, setSelectedRepo } = useAppStore(
    useShallow((state) => ({
      token: state.token,
      setToken: state.setToken,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
    }))
  )
  const [repoInput, setRepoInput] = useState('')

  // Инициализация input из выбранного репо
  useEffect(() => {
    if (selectedRepo) {
      setRepoInput(`${selectedRepo.owner}/${selectedRepo.repo}`)
    }
  }, [selectedRepo])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [owner, repo] = repoInput.split('/')
    if (owner && repo) {
      setSelectedRepo(owner.trim(), repo.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="repo-selector">
      <input
        type="text"
        placeholder="owner/repo"
        value={repoInput}
        onChange={(e) => setRepoInput(e.target.value)}
        className="repo-input"
      />
      <button type="submit" className="submit-btn">
        Загрузить
      </button>
    </form>
  )
}

/**
 * Большой RepoSelector для welcome-экрана
 */
export function RepoSelectorLarge() {
  const { token, setToken, selectedRepo, setSelectedRepo } = useAppStore(
    useShallow((state) => ({
      token: state.token,
      setToken: state.setToken,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
    }))
  )
  const [repoInput, setRepoInput] = useState('')

  useEffect(() => {
    if (selectedRepo) {
      setRepoInput(`${selectedRepo.owner}/${selectedRepo.repo}`)
    }
  }, [selectedRepo])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [owner, repo] = repoInput.split('/')
    if (owner && repo) {
      setSelectedRepo(owner.trim(), repo.trim())
    }
  }

  return (
    <div className="repo-selector-large">
      {/* Token input */}
      <div className="token-row">
        <label className="token-label">GitHub Token</label>
        <input
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onBlur={() => token && localStorage.setItem('github_token', token)}
          className="token-input-large"
        />
        <span className="token-hint">
          {token ? '✓ Токен сохранён' : 'Нужен для доступа к GitHub API'}
        </span>
      </div>

      {/* Repo input */}
      <form onSubmit={handleSubmit} className="repo-form-large">
        <label className="repo-label">Репозиторий</label>
        <div className="repo-input-row">
          <input
            type="text"
            placeholder="facebook/react"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            className="repo-input-large"
          />
          <button type="submit" className="submit-btn-large">
            Загрузить
          </button>
        </div>
        <span className="repo-hint">
          Введите owner/repo любого публичного репозитория
        </span>
      </form>

      {selectedRepo && (
        <div className="selected-repo-badge">
          ✓ Загружен: <strong>{selectedRepo.owner}/{selectedRepo.repo}</strong>
        </div>
      )}
    </div>
  )
}
