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

    // Создаём узел для текущего пути
    const node: TreeNode = {
      name,
      path,
      type: 'file',
    }

    nodeMap.set(path, node)

    // Находим родителя
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

    // Создаём промежуточные директории
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

    const fileExt = node.name.split('.').pop()?.toLowerCase()
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
