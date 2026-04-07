import { Octokit } from '@octokit/rest'

export interface Repo {
  name: string
  full_name: string
  private: boolean
  html_url: string
  description?: string
  language?: string
  stargazers_count?: number
}

export interface SearchResult {
  id: number
  full_name: string
  name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
}

export interface GitHubFile {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
  size?: number
}

export class GitHubClient {
  private octokit: Octokit | null = null

  initialize(token: string): void {
    this.octokit = new Octokit({ auth: token })
  }

  getOctokit(): Octokit {
    if (!this.octokit) {
      throw new Error('GitHub client not initialized. Call initialize() first.')
    }
    return this.octokit
  }

  async getUserRepos(token: string): Promise<Repo[]> {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.repos.listForAuthenticatedUser({
      visibility: 'all',
      affiliation: 'owner,collaborator',
      sort: 'updated',
      per_page: 100,
    })

    return data.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
    }))
  }

  async getRepoTree(
    owner: string,
    repo: string,
    token: string
  ): Promise<string[]> {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true',
    })

    return data.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path!)
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    token: string
  ): Promise<string> {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    })

    if (Array.isArray(data)) {
      throw new Error(`Expected a file, but got a directory at ${path}`)
    }

    if ('content' in data && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }

    throw new Error(`No content found at ${path}`)
  }

  async searchRepos(
    query: string,
    token: string,
    perPage: number = 15
  ): Promise<SearchResult[]> {
    const octokit = new Octokit({ auth: token })

    // Улучшенный поиск: добавляем wildcard и поиск по name
    // GitHub Search API поддерживает qualifiers
    // in:name — поиск только по имени (более точный)
    // Без qualifier — поиск по name + description (более широкий)
    // Используем оба подхода и объединяем результаты

    const searchQuery = query.includes('/')
      ? query // Если есть / — это owner/repo, ищем точно
      : `${query} in:name` // Иначе ищем по имени репозитория

    const { data } = await octokit.search.repos({
      q: searchQuery,
      sort: 'stars',
      order: 'desc',
      per_page: perPage,
    })

    return data.items.map((item) => ({
      id: item.id,
      full_name: item.full_name,
      name: item.name,
      html_url: item.html_url,
      description: item.description,
      language: item.language,
      stargazers_count: item.stargazers_count,
      forks_count: item.forks_count,
      updated_at: item.updated_at,
    }))
  }
}

export const githubClient = new GitHubClient()
