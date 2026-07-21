import { SessionRecord } from '../history/historyEngine'
import { TreeNode } from '../repository/treeBuilder'

/**
 * Звёзды для рейтинга (0 = не начато, 1-3 = прогресс)
 */
export type StarRating = 0 | 1 | 2 | 3

/**
 * Прогресс одного файла
 */
export interface FileProgress {
  filePath: string
  fileName: string
  /** Расширение файла для иконки */
  extension: string
  stars: StarRating
  bestWpm: number
  bestAccuracy: number
  /** Количество тренировочных сессий на этом файле */
  sessions: number
  /** Файл помечен как завершённый */
  isCompleted: boolean
}

/**
 * Прогресс одной директории (группа файлов)
 */
export interface DirectoryProgress {
  name: string
  path: string
  files: FileProgress[]
  /** Средний рейтинг звёзд (0-3) */
  avgStars: number
  /** Процент завершённых файлов */
  completionPercent: number
  /** Всего файлов */
  totalFiles: number
  /** Завершённых файлов */
  completedFiles: number
}

/**
 * Общая статистика карты
 */
export interface MapOverview {
  totalFiles: number
  completedFiles: number
  completionPercent: number
  totalStars: number
  maxPossibleStars: number
  avgWpm: number
  avgAccuracy: number
}

/**
 * Вычисляет звёздный рейтинг по WPM и accuracy
 * ⭐    = завершено (accuracy < 85 или wpm < 15)
 * ⭐⭐  = хорошо  (accuracy >= 85 и wpm >= 15)
 * ⭐⭐⭐ = отлично (accuracy >= 95 и wpm >= 35)
 */
export function calculateStars(wpm: number, accuracy: number): 1 | 2 | 3 {
  if (accuracy >= 95 && wpm >= 35) return 3
  if (accuracy >= 85 && wpm >= 15) return 2
  return 1
}

/**
 * Собирает лучшую статистику по файлу из истории сессий
 */
export function getFileStats(
  filePath: string,
  sessions: SessionRecord[]
): { bestWpm: number; bestAccuracy: number; sessionCount: number } {
  const fileSessions = sessions.filter((s) => s.filePath === filePath)
  if (fileSessions.length === 0) {
    return { bestWpm: 0, bestAccuracy: 0, sessionCount: 0 }
  }

  let bestWpm = 0
  let bestAccuracy = 0
  for (const s of fileSessions) {
    if (s.wpm > bestWpm) bestWpm = s.wpm
    if (s.accuracy > bestAccuracy) bestAccuracy = s.accuracy
  }

  return { bestWpm, bestAccuracy, sessionCount: fileSessions.length }
}

/**
 * Извлекает расширение файла
 */
function getExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Рекурсивно собирает все файлы из TreeNode[] в плоский список
 * с сохранением директории-родителя
 */
function collectFiles(
  nodes: TreeNode[],
  parentDir: string = ''
): Array<{ filePath: string; fileName: string; directory: string }> {
  const result: Array<{ filePath: string; fileName: string; directory: string }> = []

  for (const node of nodes) {
    if (node.type === 'file') {
      result.push({
        filePath: node.path,
        fileName: node.name,
        directory: parentDir || '/',
      })
    } else if (node.type === 'directory' && node.children) {
      result.push(...collectFiles(node.children, node.path))
    }
  }

  return result
}

/**
 * Строит карту прогресса по директориям
 */
export function buildProgressMap(
  tree: TreeNode[],
  sessions: SessionRecord[],
  completedFiles: string[]
): DirectoryProgress[] {
  const allFiles = collectFiles(tree)

  // Группируем по директории
  const dirMap = new Map<string, Array<{ filePath: string; fileName: string }>>()
  for (const file of allFiles) {
    const dir = file.directory
    if (!dirMap.has(dir)) dirMap.set(dir, [])
    dirMap.get(dir)!.push(file)
  }

  const directories: DirectoryProgress[] = []

  for (const [dirPath, files] of dirMap) {
    const fileProgresses: FileProgress[] = files.map((f) => {
      const stats = getFileStats(f.filePath, sessions)
      const isCompleted = completedFiles.includes(f.filePath) || stats.sessionCount > 0
      const stars: StarRating = isCompleted
        ? calculateStars(stats.bestWpm, stats.bestAccuracy)
        : 0

      return {
        filePath: f.filePath,
        fileName: f.fileName,
        extension: getExtension(f.fileName),
        stars,
        bestWpm: stats.bestWpm,
        bestAccuracy: stats.bestAccuracy,
        sessions: stats.sessionCount,
        isCompleted,
      }
    })

    const completed = fileProgresses.filter((f) => f.isCompleted)
    const totalStars = fileProgresses.reduce((sum, f) => sum + f.stars, 0)
    const avgStars = fileProgresses.length > 0 ? totalStars / fileProgresses.length : 0

    directories.push({
      name: dirPath === '/' ? 'Корень' : dirPath.split('/').pop() || dirPath,
      path: dirPath,
      files: fileProgresses,
      avgStars: Math.round(avgStars * 10) / 10,
      completionPercent:
        fileProgresses.length > 0
          ? Math.round((completed.length / fileProgresses.length) * 100)
          : 0,
      totalFiles: fileProgresses.length,
      completedFiles: completed.length,
    })
  }

  // Сортируем: директории с прогрессом — первые
  return directories.sort((a, b) => {
    if (a.completedFiles > 0 && b.completedFiles === 0) return -1
    if (a.completedFiles === 0 && b.completedFiles > 0) return 1
    return a.path.localeCompare(b.path)
  })
}

/**
 * Вычисляет общую статистику карты
 */
export function getMapOverview(directories: DirectoryProgress[]): MapOverview {
  let totalFiles = 0
  let completedFiles = 0
  let totalStars = 0
  let wpmSum = 0
  let accSum = 0
  let completedCount = 0

  for (const dir of directories) {
    totalFiles += dir.totalFiles
    completedFiles += dir.completedFiles
    for (const file of dir.files) {
      totalStars += file.stars
      if (file.isCompleted && file.bestWpm > 0) {
        wpmSum += file.bestWpm
        accSum += file.bestAccuracy
        completedCount++
      }
    }
  }

  return {
    totalFiles,
    completedFiles,
    completionPercent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
    totalStars,
    maxPossibleStars: totalFiles * 3,
    avgWpm: completedCount > 0 ? Math.round(wpmSum / completedCount) : 0,
    avgAccuracy: completedCount > 0 ? Math.round(accSum / completedCount) : 0,
  }
}

/**
 * Возвращает иконку по расширению файла
 */
export function getFileIcon(extension: string): string {
  const icons: Record<string, string> = {
    ts: '🟦', tsx: '⚛️', js: '🟨', jsx: '⚛️',
    py: '🐍', go: '🔷', rs: '🦀', java: '☕',
    cpp: '⚙️', c: '⚙️', cs: '💎', rb: '💎',
    swift: '🍎', kt: '🟣', dart: '🎯',
    html: '🌐', css: '🎨', scss: '🎨',
    vue: '💚', svelte: '🧡',
    json: '📋', yaml: '📋', yml: '📋', toml: '📋',
    md: '📝', txt: '📄',
    sh: '🐚', bash: '🐚',
    sql: '🗃️', dockerfile: '🐳',
  }
  return icons[extension] || '📄'
}

/**
 * Рендерит звёзды текстом
 */
export function renderStars(stars: StarRating): string {
  if (stars === 0) return '☆☆☆'
  if (stars === 1) return '★☆☆'
  if (stars === 2) return '★★☆'
  return '★★★'
}
