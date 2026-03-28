import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

dotenv.config();

export class GitHubService {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token
    });
  }

  async getRepos(username?: string): Promise<{ name: string; full_name: string }[]> {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        visibility: 'all',
        affiliation: 'owner,collaborator',
        sort: 'updated',
        per_page: 100
      });

      return data.map(repo => ({
        name: repo.name,
        full_name: repo.full_name
      }));
    } catch (error) {
      if (username) {
        const { data } = await this.octokit.repos.listForUser({
          username,
          per_page: 100
        });
        return data.map(repo => ({
          name: repo.name,
          full_name: repo.full_name
        }));
      }
      throw error;
    }
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path
      });

      if (Array.isArray(data)) {
        throw new Error('Это директория, а не файл');
      }

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return content;
      }

      throw new Error('Не удалось получить содержимое файла');
    } catch (error) {
      throw error;
    }
  }

  async getFilesInRepo(owner: string, repo: string, path: string = ''): Promise<{ name: string; path: string; type: string }[]> {
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path
    });

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter(item => item.type === 'file' || item.type === 'dir')
      .map(item => ({
        name: item.name,
        path: item.path,
        type: item.type
      }));
  }

  async getCurrentUser(): Promise<string> {
    const { data } = await this.octokit.users.getAuthenticated();
    return data.login;
  }
}
