import { create } from 'zustand'
import { TreeNode } from '../core/repository/treeBuilder'
import { CodeBlock } from '../core/ast/languageAdapter'
import { TypingStats } from '..//core/typing/statsEngine'

export type TrainerMode = 'full-file' | 'code-block'
export type AppView = 'repo-select' | 'book-select' | 'trainer'

interface ProgressState {
  completedFiles: string[]
  completedBlocks: string[]
}

interface RepoState {
  token: string
  selectedRepo: { owner: string; repo: string } | null
  fileTree: TreeNode[]
  selectedFile: string | null
  fileContent: string | null
  codeBlocks: CodeBlock[]
  selectedBlock: CodeBlock | null
  languageFilter: string
  progress: ProgressState
}

interface TrainerState {
  mode: TrainerMode
  userInput: string
  startTime: number | null
  endTime: number | null
  stats: TypingStats | null
  isComplete: boolean
  view: AppView
  skippedPositions: Set<number> | null
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
  addCompletedFile: (path: string) => void
  addCompletedBlock: (id: string) => void
  loadProgress: (owner: string, repo: string) => void

  // Trainer actions
  setMode: (mode: TrainerMode) => void
  setUserInput: (input: string) => void
  setStartTime: (time: number | null) => void
  setEndTime: (time: number | null) => void
  setStats: (stats: TypingStats | null) => void
  setIsComplete: (complete: boolean) => void
  setView: (view: AppView) => void
  setSkippedPositions: (positions: Set<number> | null) => void
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
  progress: {
    completedFiles: [],
    completedBlocks: [],
  },
}

const initialTrainerState: TrainerState = {
  mode: 'full-file',
  userInput: '',
  startTime: null,
  endTime: null,
  stats: null,
  isComplete: false,
  view: 'repo-select',
  skippedPositions: null,
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

  addCompletedFile: (path) => set((state) => {
    if (!state.selectedRepo) return state
    if (state.progress.completedFiles.includes(path)) return state
    const newProgress = {
      ...state.progress,
      completedFiles: [...state.progress.completedFiles, path]
    }
    const key = `gittype_progress_${state.selectedRepo.owner}_${state.selectedRepo.repo}`
    localStorage.setItem(key, JSON.stringify(newProgress))
    return { progress: newProgress }
  }),

  addCompletedBlock: (id) => set((state) => {
    if (!state.selectedRepo) return state
    if (state.progress.completedBlocks.includes(id)) return state
    const newProgress = {
      ...state.progress,
      completedBlocks: [...state.progress.completedBlocks, id]
    }
    const key = `gittype_progress_${state.selectedRepo.owner}_${state.selectedRepo.repo}`
    localStorage.setItem(key, JSON.stringify(newProgress))
    return { progress: newProgress }
  }),

  loadProgress: (owner, repo) => set(() => {
    const key = `gittype_progress_${owner}_${repo}`
    const data = localStorage.getItem(key)
    if (data) {
      try {
        return { progress: JSON.parse(data) }
      } catch (e) { }
    }
    return { progress: { completedFiles: [], completedBlocks: [] } }
  }),

  // Trainer actions
  setMode: (mode) => set({ mode }),

  setUserInput: (input) => set({ userInput: input }),

  setStartTime: (time) => set({ startTime: time }),

  setEndTime: (time) => set({ endTime: time }),

  setStats: (stats) => set({ stats }),

  setIsComplete: (complete) => set({ isComplete: complete }),

  setView: (view) => set({ view }),

  setSkippedPositions: (positions) => set({ skippedPositions: positions }),

  resetTrainer: () =>
    set({
      userInput: '',
      startTime: null,
      endTime: null,
      stats: null,
      isComplete: false,
      skippedPositions: null,
    }),
}))
