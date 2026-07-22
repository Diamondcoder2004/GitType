import { describe, it, expect } from 'vitest'
import {
  calculateStars,
  getFileStats,
  buildProgressMap,
  getMapOverview,
  getFileIcon,
  renderStars,
} from '../core/codemap/codeMapEngine'
import { SessionRecord } from '../core/history/historyEngine'
import { TreeNode } from '../core/repository/treeBuilder'

describe('codeMapEngine', () => {
  describe('calculateStars', () => {
    it('возвращает 1 звезду при низкой accuracy', () => {
      expect(calculateStars(50, 70)).toBe(1)
    })

    it('возвращает 1 звезду при низкой скорости', () => {
      expect(calculateStars(10, 99)).toBe(1)
    })

    it('возвращает 2 звезды при хорошем результате', () => {
      expect(calculateStars(20, 90)).toBe(2)
    })

    it('возвращает 3 звезды при отличном результате', () => {
      expect(calculateStars(40, 97)).toBe(3)
    })

    it('граничный случай: accuracy=95, wpm=35 → 3 звезды', () => {
      expect(calculateStars(35, 95)).toBe(3)
    })

    it('граничный случай: accuracy=85, wpm=15 → 2 звезды', () => {
      expect(calculateStars(15, 85)).toBe(2)
    })

    it('граничный случай: accuracy=84 → 1 звезда', () => {
      expect(calculateStars(40, 84)).toBe(1)
    })
  })

  describe('getFileStats', () => {
    const sessions: SessionRecord[] = [
      { id: '1', timestamp: 1, wpm: 30, cpm: 150, accuracy: 90, errors: 5, duration: 60, totalChars: 150, correctChars: 135, mode: 'full-file', filePath: 'src/app.ts' },
      { id: '2', timestamp: 2, wpm: 50, cpm: 250, accuracy: 95, errors: 2, duration: 60, totalChars: 250, correctChars: 237, mode: 'full-file', filePath: 'src/app.ts' },
      { id: '3', timestamp: 3, wpm: 40, cpm: 200, accuracy: 88, errors: 8, duration: 60, totalChars: 200, correctChars: 176, mode: 'full-file', filePath: 'src/other.ts' },
    ]

    it('возвращает лучшие показатели по файлу', () => {
      const stats = getFileStats('src/app.ts', sessions)
      expect(stats.bestWpm).toBe(50)
      expect(stats.bestAccuracy).toBe(95)
      expect(stats.sessionCount).toBe(2)
    })

    it('возвращает нули для файла без сессий', () => {
      const stats = getFileStats('src/unknown.ts', sessions)
      expect(stats.bestWpm).toBe(0)
      expect(stats.bestAccuracy).toBe(0)
      expect(stats.sessionCount).toBe(0)
    })
  })

  describe('buildProgressMap', () => {
    const tree: TreeNode[] = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          { name: 'app.ts', path: 'src/app.ts', type: 'file' },
          { name: 'index.ts', path: 'src/index.ts', type: 'file' },
        ],
      },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]

    it('строит карту директорий', () => {
      const result = buildProgressMap(tree, [], [])
      expect(result.length).toBe(2) // src + корень
    })

    it('отмечает прогресс по файлам', () => {
      const sessions: SessionRecord[] = [
        { id: '1', timestamp: 1, wpm: 40, cpm: 200, accuracy: 96, errors: 2, duration: 60, totalChars: 200, correctChars: 192, mode: 'full-file', filePath: 'src/app.ts' },
      ]
      const result = buildProgressMap(tree, sessions, ['src/app.ts'])
      const srcDir = result.find((d) => d.path === 'src')!
      expect(srcDir).toBeDefined()
      expect(srcDir.completedFiles).toBe(1)
      expect(srcDir.totalFiles).toBe(2)
      expect(srcDir.completionPercent).toBe(50)

      const appFile = srcDir.files.find((f) => f.filePath === 'src/app.ts')!
      expect(appFile.isCompleted).toBe(true)
      expect(appFile.stars).toBe(3) // wpm=40, acc=96 → 3 stars
    })

    it('файлы без сессий имеют 0 звёзд', () => {
      const result = buildProgressMap(tree, [], [])
      const srcDir = result.find((d) => d.path === 'src')!
      expect(srcDir.files[0].stars).toBe(0)
      expect(srcDir.files[0].isCompleted).toBe(false)
    })
  })

  describe('getMapOverview', () => {
    it('вычисляет общую статистику', () => {
      const dirs = buildProgressMap(
        [
          {
            name: 'src', path: 'src', type: 'directory',
            children: [
              { name: 'a.ts', path: 'src/a.ts', type: 'file' },
              { name: 'b.ts', path: 'src/b.ts', type: 'file' },
              { name: 'c.ts', path: 'src/c.ts', type: 'file' },
            ],
          },
        ],
        [
          { id: '1', timestamp: 1, wpm: 40, cpm: 200, accuracy: 96, errors: 2, duration: 60, totalChars: 200, correctChars: 192, mode: 'full-file' as const, filePath: 'src/a.ts' },
          { id: '2', timestamp: 2, wpm: 20, cpm: 100, accuracy: 88, errors: 6, duration: 60, totalChars: 100, correctChars: 88, mode: 'full-file' as const, filePath: 'src/b.ts' },
        ],
        ['src/a.ts', 'src/b.ts']
      )
      const overview = getMapOverview(dirs)
      expect(overview.totalFiles).toBe(3)
      expect(overview.completedFiles).toBe(2)
      expect(overview.completionPercent).toBe(67)
      expect(overview.avgWpm).toBe(30) // (40+20)/2
    })
  })

  describe('getFileIcon', () => {
    it('возвращает иконку для известных расширений', () => {
      expect(getFileIcon('ts')).toBe('TS')
      expect(getFileIcon('py')).toBe('PY')
      expect(getFileIcon('go')).toBe('GO')
      expect(getFileIcon('rs')).toBe('RS')
    })

    it('возвращает первые 2 буквы для неизвестных расширений', () => {
      expect(getFileIcon('xyz')).toBe('XY')
    })
  })

  describe('renderStars', () => {
    it('корректно рендерит звёзды', () => {
      expect(renderStars(0)).toBe('☆☆☆')
      expect(renderStars(1)).toBe('★☆☆')
      expect(renderStars(2)).toBe('★★☆')
      expect(renderStars(3)).toBe('★★★')
    })
  })
})
