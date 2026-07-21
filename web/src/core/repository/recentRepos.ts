export interface RecentRepo {
  owner: string
  repo: string
  language?: string
  lastUsed: number
}

const STORAGE_KEY = 'gittype_recent_repos'
const MAX_RECENT = 10

export function getRecentRepos(): RecentRepo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addRecentRepo(owner: string, repo: string, language?: string): void {
  const recent = getRecentRepos().filter(
    (r) => !(r.owner === owner && r.repo === repo)
  )
  recent.unshift({ owner, repo, language, lastUsed: Date.now() })
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
}

export function removeRecentRepo(owner: string, repo: string): void {
  const recent = getRecentRepos().filter(
    (r) => !(r.owner === owner && r.repo === repo)
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
}
