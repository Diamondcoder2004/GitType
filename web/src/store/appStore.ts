import { create } from 'zustand'
import { TreeNode } from '../core/repository/treeBuilder'
import { CodeBlock } from '../core/ast/languageAdapter'
import { TypingStats } from '..//core/typing/statsEngine'

export type TrainerMode = 'full-block' | 'implement'
export type AppView = 'repo-select' | 'trainer'

interface RepoState {
  token: string
  selectedRepo: { owner: string; repo: string } | null
  fileTree: TreeNode[]
  selectedFile: string | null
  fileContent: string | null
  codeBlocks: CodeBlock[]
  selectedBlock: CodeBlock | null
  languageFilter: string
}

interface TrainerState {
  mode: TrainerMode
  userInput: string
  startTime: number | null
  endTime: number | null
  stats: TypingStats | null
  isComplete: boolean
  view: AppView
}

interface Actions {
  // Repo actions
  setToken: (token: string) => void
  setSelectedRepo: (owner: string, repo: string) => void
  setFileTree: (tree: TreeNode[]) => void
  setSelectedFile: (path: string | null) => void
  setFileContent: (content: string | null) => void
  setCodeBlocks: (blocks: CodeBlock[]) => void
  setSelectedBlock: (block: CodeBlock | null) => void
  setLanguageFilter: (lang: string) => void

  // Trainer actions
  setMode: (mode: TrainerMode) => void
  setUserInput: (input: string) => void
  setStartTime: (time: number | null) => void
  setEndTime: (time: number | null) => void
  setStats: (stats: TypingStats | null) => void
  setIsComplete: (complete: boolean) => void
  setView: (view: AppView) => void
  resetTrainer: () => void
}

const initialRepoState: RepoState = {
  token: '',
  selectedRepo: null,
  fileTree: [],
  selectedFile: null,
  fileContent: null,
  codeBlocks: [],
  selectedBlock: null,
  languageFilter: 'all',
}

const initialTrainerState: TrainerState = {
  mode: 'full-block',
  userInput: '',
  startTime: null,
  endTime: null,
  stats: null,
  isComplete: false,
  view: 'repo-select',
}

export const useAppStore = create<RepoState & TrainerState & Actions>()((set) => ({
  // Initial state
  ...initialRepoState,
  ...initialTrainerState,

  // Repo actions
  setToken: (token) => set({ token }),

  setSelectedRepo: (owner, repo) =>
    set({ selectedRepo: { owner, repo }, view: 'trainer' }),

  setFileTree: (tree) => set({ fileTree: tree }),

  setSelectedFile: (path) => set({ selectedFile: path }),

  setFileContent: (content) => set({ fileContent: content }),

  setCodeBlocks: (blocks) => set({ codeBlocks: blocks }),

  setSelectedBlock: (block) => set({ selectedBlock: block }),

  setLanguageFilter: (lang) => set({ languageFilter: lang }),

  // Trainer actions
  setMode: (mode) => set({ mode }),

  setUserInput: (input) => set({ userInput: input }),

  setStartTime: (time) => set({ startTime: time }),

  setEndTime: (time) => set({ endTime: time }),

  setStats: (stats) => set({ stats }),

  setIsComplete: (complete) => set({ isComplete: complete }),

  setView: (view) => set({ view }),

  resetTrainer: () =>
    set({
      userInput: '',
      startTime: null,
      endTime: null,
      stats: null,
      isComplete: false,
    }),
}))
