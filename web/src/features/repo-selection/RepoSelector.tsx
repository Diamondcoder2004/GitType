import { useState, useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { useAppStore } from '../../store/appStore'
import { githubClient } from '../../core/github/githubClient'
import type { SearchResult } from '../../core/github/githubClient'
import './RepoSelector.css'

export function RepoSelector() {
  const { token, selectedRepo, setSelectedRepo } = useAppStore(
    useShallow((state) => ({
      token: state.token,
      selectedRepo: state.selectedRepo,
      setSelectedRepo: state.setSelectedRepo,
    }))
  )
  const [repoInput, setRepoInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Инициализация input из выбранного репо
  useEffect(() => {
    if (selectedRepo) {
      setRepoInput(`${selectedRepo.owner}/${selectedRepo.repo}`)
    }
  }, [selectedRepo])

  // Debounce поиска
  useEffect(() => {
    if (!token || searchQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await githubClient.searchRepos(searchQuery, token)
        setSearchResults(results)
        setShowDropdown(true)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, token])

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [owner, repo] = repoInput.split('/')
    if (owner && repo) {
      setSelectedRepo(owner.trim(), repo.trim())
      setShowDropdown(false)
    }
  }

  const handleSelectRepo = useCallback((result: SearchResult) => {
    const [owner, repo] = result.full_name.split('/')
    setSelectedRepo(owner, repo)
    setRepoInput(result.full_name)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }, [setSelectedRepo])

  return (
    <div className="repo-selector" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="repo-selector-form">
        <input
          type="text"
          placeholder="owner/repo или поиск..."
          value={showDropdown ? searchQuery : repoInput}
          onChange={(e) => {
            const val = e.target.value
            setRepoInput(val)
            setSearchQuery(val)
          }}
          onFocus={() => {
            if (searchResults.length > 0) setShowDropdown(true)
          }}
          className="repo-input"
        />
        <button type="submit" className="submit-btn">
          Загрузить
        </button>
      </form>

      {/* Search dropdown */}
      {showDropdown && (searchResults.length > 0 || isSearching) && (
        <div className="repo-search-dropdown">
          {isSearching && (
            <div className="repo-search-loading">
              <span className="loading-spinner">⏳</span>
              <span>Поиск репозиториев...</span>
            </div>
          )}
          {searchResults.map((result) => (
            <button
              key={result.id}
              className="repo-search-item"
              onClick={() => handleSelectRepo(result)}
            >
              <div className="repo-search-name">
                <span className="repo-name-full">{result.full_name}</span>
              </div>
              {result.description && (
                <div className="repo-search-desc">{result.description}</div>
              )}
              <div className="repo-search-meta">
                {result.language && (
                  <span className="repo-lang" data-lang={result.language}>{result.language}</span>
                )}
                <span className="repo-stars">{result.stargazers_count.toLocaleString()}</span>
                <span className="repo-forks">{result.forks_count.toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRepo) {
      setRepoInput(`${selectedRepo.owner}/${selectedRepo.repo}`)
    }
  }, [selectedRepo])

  // Debounce поиска
  useEffect(() => {
    if (!token || searchQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await githubClient.searchRepos(searchQuery, token)
        setSearchResults(results)
        setShowDropdown(true)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, token])

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [owner, repo] = repoInput.split('/')
    if (owner && repo) {
      setSelectedRepo(owner.trim(), repo.trim())
      setShowDropdown(false)
    }
  }

  const handleSelectRepo = useCallback((result: SearchResult) => {
    const [owner, repo] = result.full_name.split('/')
    setSelectedRepo(owner, repo)
    setRepoInput(result.full_name)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }, [setSelectedRepo])

  return (
    <div className="repo-selector-large" ref={dropdownRef}>
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

      {/* Repo input with search */}
      <div className="repo-form-large">
        <label className="repo-label">Репозиторий</label>
        <div className="repo-input-row">
          <form onSubmit={handleSubmit} className="repo-search-wrapper">
            <input
              type="text"
              placeholder="facebook/react или поиск по названию..."
              value={showDropdown ? searchQuery : repoInput}
              onChange={(e) => {
                const val = e.target.value
                setRepoInput(val)
                setSearchQuery(val)
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true)
              }}
              className="repo-input-large"
            />
            <button type="submit" className="submit-btn-large">
              Загрузить
            </button>
          </form>
        </div>
        <span className="repo-hint">
          Введите owner/repo или начните печатать для поиска
        </span>

        {/* Search dropdown */}
        {showDropdown && (searchResults.length > 0 || isSearching) && (
          <div className="repo-search-dropdown">
            {isSearching && (
              <div className="repo-search-loading">
                <span className="loading-spinner">⏳</span>
                <span>Поиск репозиториев...</span>
              </div>
            )}
            {searchResults.map((result) => (
              <button
                key={result.id}
                className="repo-search-item"
                onClick={() => handleSelectRepo(result)}
              >
                <div className="repo-search-name">
                  <span className="repo-name-full">{result.full_name}</span>
                </div>
                {result.description && (
                  <div className="repo-search-desc">{result.description}</div>
                )}
                <div className="repo-search-meta">
                  {result.language && (
                    <span className="repo-lang" data-lang={result.language}>{result.language}</span>
                  )}
                  <span className="repo-stars">{result.stargazers_count.toLocaleString()}</span>
                  <span className="repo-forks">{result.forks_count.toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRepo && (
        <div className="selected-repo-badge">
          ✓ Загружен: <strong>{selectedRepo.owner}/{selectedRepo.repo}</strong>
        </div>
      )}
    </div>
  )
}
