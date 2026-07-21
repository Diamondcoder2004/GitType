export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

/**
 * Строит иерархическое дерево файлов из плоского списка путей
 * Pure function - без побочных эффектов
 */
export function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []
  const nodeMap = new Map<string, TreeNode>()

  // Сортировка путей для корректного построения
  const sortedPaths = [...paths].sort()

  for (const path of sortedPaths) {
    const parts = path.split('/')
    const name = parts[parts.length - 1]

    // Сначала создаём все нужные директории по пути
    let currentPath = ''
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      const prevPath = currentPath
      currentPath = currentPath ? `${currentPath}/${dirName}` : dirName

      if (!nodeMap.has(currentPath)) {
        const dirNode: TreeNode = {
          name: dirName,
          path: currentPath,
          type: 'directory',
          children: [],
        }
        nodeMap.set(currentPath, dirNode)

        const grandParent = prevPath ? nodeMap.get(prevPath) : null
        if (grandParent && grandParent.children) {
          grandParent.children.push(dirNode)
        } else {
          root.push(dirNode)
        }
      }
    }

    // Создаём узел для самого файла
    const node: TreeNode = {
      name,
      path,
      type: 'file',
    }

    nodeMap.set(path, node)

    // Находим родителя (теперь он точно есть, если это не файл в корне)
    const parentPath = parts.slice(0, -1).join('/')
    const parent = parentPath ? nodeMap.get(parentPath) : null

    if (parent) {
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(node)
    } else {
      root.push(node)
    }
  }

  // Сортировка: сначала директории, потом файлы, по алфавиту
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      // Директории перед файлами
      if (a.type === 'directory' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'directory') return 1

      // Алфавитный порядок
      return a.name.localeCompare(b.name)
    })
  }

  // Рекурсивная сортировка детей
  const sortTree = (nodes: TreeNode[]): TreeNode[] => {
    const sorted = sortNodes(nodes)
    for (const node of sorted) {
      if (node.children) {
        node.children = sortTree(node.children)
      }
    }
    return sorted
  }

  return sortTree(root)
}

/**
 * Фильтрует дерево файлов по расширению
 */
export function filterTreeByExtension(
  tree: TreeNode[],
  extension: string | 'all'
): TreeNode[] {
  if (extension === 'all') return tree

  const filterNode = (node: TreeNode): TreeNode | null => {
    if (node.type === 'directory') {
      const children = node.children?.flatMap((child) => {
        const filtered = filterNode(child)
        return filtered ? [filtered] : []
      })

      if (children && children.length > 0) {
        return { ...node, children }
      }
      return null
    }

    const fileName = node.name.toLowerCase()
    const fileExt = node.name.split('.').pop()?.toLowerCase()

    // Специальная обработка для Dockerfile, Makefile и т.д.
    if (extension === 'dockerfile' && (fileName === 'dockerfile' || fileName.startsWith('dockerfile'))) {
      return node
    }
    if (extension === 'makefile' && fileName === 'makefile') {
      return node
    }

    if (fileExt === extension) {
      return node
    }
    return null
  }

  return tree.flatMap((node) => {
    const filtered = filterNode(node)
    return filtered ? [filtered] : []
  })
}

/**
 * Собирает все файлы из дерева в плоский список
 */
export function flattenTree(tree: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []

  const traverse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push(node)
      }
      if (node.children) {
        traverse(node.children)
      }
    }
  }

  traverse(tree)
  return result
}

/**
 * Строит "Путь обучения" (эвристический порядок файлов для изучения)
 */
export function buildLearningPath(tree: TreeNode[]): TreeNode[] {
  const allFiles = flattenTree(tree)
  
  // Правила оценки (меньше = раньше)
  const getScore = (name: string, path: string) => {
    const lPath = path.toLowerCase()
    const lName = name.toLowerCase()
    
    // 1. Configs and Env
    if (lName === 'package.json') return 10
    if (lName === 'docker-compose.yml' || lName === 'dockerfile') return 11
    if (lName.includes('config')) return 12
    if (lName === '.env.example' || lName === '.env') return 13
    
    // 2. Entry points
    if (lName === 'index.html') return 20
    if (lName === 'main.ts' || lName === 'main.js' || lName === 'main.py') return 21
    if (lName === 'index.ts' || lName === 'index.js') return 22
    if (lName === 'app.tsx' || lName === 'app.vue' || lName === 'app.ts') return 23
    
    // 3. Core/Store/Router/Architecture
    if (lPath.includes('/store/') || lPath.includes('/state/')) return 30
    if (lPath.includes('/router/') || lPath.includes('/routes/')) return 31
    if (lPath.includes('/core/')) return 32
    
    // 4. API/Services
    if (lPath.includes('/api/') || lPath.includes('/services/')) return 40
    
    // 5. Types/Interfaces
    if (lPath.includes('/types/') || lPath.includes('/interfaces/')) return 50
    if (lName.endsWith('.d.ts')) return 51
    
    // 6. Features/Components
    if (lPath.includes('/features/')) return 60
    if (lPath.includes('/components/')) return 61
    if (lPath.includes('/views/') || lPath.includes('/pages/')) return 62
    
    // 7. Utils/Helpers
    if (lPath.includes('/utils/') || lPath.includes('/helpers/')) return 70
    
    // 8. Tests
    if (lPath.includes('/tests/') || lName.includes('.test.') || lName.includes('.spec.')) return 90
    
    // 9. Docs
    if (lName.endsWith('.md')) return 100
    if (lName === 'gitignore') return 101
    
    // Default
    return 80
  }
  
  return allFiles.sort((a, b) => {
    const scoreA = getScore(a.name, a.path)
    const scoreB = getScore(b.name, b.path)
    if (scoreA !== scoreB) return scoreA - scoreB
    return a.path.localeCompare(b.path)
  })
}
