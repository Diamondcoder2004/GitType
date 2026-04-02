import { useState } from 'react'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import './RepoSelector.css'

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
          placeholder="owner/repo (например: almaz/GitType)"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          className="repo-input"
        />
        <button type="submit" className="submit-btn">
          Загрузить
        </button>
      </form>

      {selectedRepo && (
        <div className="selected-repo">
          Выбран: <strong>{selectedRepo.owner}/{selectedRepo.repo}</strong>
        </div>
      )}
    </div>
  )
}
