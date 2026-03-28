import { describe, it, expect } from 'vitest'
import { buildFileTree, filterTreeByExtension, flattenTree } from '@core/repository/treeBuilder'

describe('buildFileTree', () => {
  it('должно строить дерево из плоского списка путей', () => {
    const paths = [
      'src/index.ts',
      'src/utils/helper.ts',
      'src/components/App.tsx',
      'README.md',
    ]

    const tree = buildFileTree(paths)

    expect(tree.length).toBe(2) // src и README.md
    
    const srcNode = tree.find((n) => n.name === 'src')
    expect(srcNode).toBeDefined()
    expect(srcNode?.type).toBe('directory')
    expect(srcNode?.children?.length).toBe(3) // index.ts, utils, components
  })

  it('должно сортировать директории перед файлами', () => {
    const paths = [
      'src/file.ts',
      'src/dir/file.ts',
      'README.md',
    ]

    const tree = buildFileTree(paths)
    const srcNode = tree.find((n) => n.name === 'src')
    
    expect(srcNode?.children?.[0].type).toBe('directory')
    expect(srcNode?.children?.[1].type).toBe('file')
  })

  it('должно сортировать по алфавиту', () => {
    const paths = [
      'src/zebra.ts',
      'src/alpha.ts',
      'src/beta.ts',
    ]

    const tree = buildFileTree(paths)
    const srcNode = tree.find((n) => n.name === 'src')
    
    expect(srcNode?.children?.map((c) => c.name)).toEqual(['alpha.ts', 'beta.ts', 'zebra.ts'])
  })
})

describe('filterTreeByExtension', () => {
  it('должно фильтровать файлы по расширению', () => {
    const paths = [
      'src/index.ts',
      'src/style.css',
      'src/utils.ts',
    ]

    const tree = buildFileTree(paths)
    const filtered = filterTreeByExtension(tree, 'ts')

    const flat = flattenTree(filtered)
    expect(flat.length).toBe(2)
    expect(flat.every((f) => f.name.endsWith('.ts'))).toBe(true)
  })

  it('должно возвращать всё дерево для "all"', () => {
    const paths = ['src/index.ts', 'src/style.css']
    const tree = buildFileTree(paths)
    const filtered = filterTreeByExtension(tree, 'all')

    expect(flattenTree(filtered).length).toBe(2)
  })
})

describe('flattenTree', () => {
  it('должно преобразовывать дерево в плоский список', () => {
    const paths = [
      'src/index.ts',
      'src/utils/helper.ts',
      'README.md',
    ]

    const tree = buildFileTree(paths)
    const flat = flattenTree(tree)

    expect(flat.length).toBe(3)
    expect(flat.map((f) => f.path)).toEqual(
      expect.arrayContaining(['src/index.ts', 'src/utils/helper.ts', 'README.md'])
    )
  })
})
