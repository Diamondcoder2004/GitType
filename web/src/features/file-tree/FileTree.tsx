import { useState, useCallback } from 'react'
import { TreeNode } from '../../core/repository/treeBuilder'
import './FileTree.css'

// Маппинг расширений → иконки
const FILE_ICONS: Record<string, string> = {
  ts: '🔷', tsx: '⚛️', js: '📜', jsx: '⚛️',
  py: '🐍', go: '🐹', rs: '🦀', java: '☕',
  cpp: '⚙️', c: '⚙️', cs: '🟣', php: '🐘',
  rb: '💎', swift: '🍎', kt: '🟠',
  html: '🌐', css: '🎨', scss: '🎨', sass: '🎨',
  json: '📋', xml: '📋', yaml: '📋', yml: '📋',
  md: '📝', sh: '🖥️', bash: '🖥️',
  dockerfile: '🐳', sql: '🗃️', vue: '💚',
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const lowerName = name.toLowerCase()
  if (lowerName === 'dockerfile') return FILE_ICONS.dockerfile
  return FILE_ICONS[ext] || '📄'
}

interface FileTreeItemProps {
  node: TreeNode
  selectedPath: string | null
  onSelect: (path: string) => void
  expandedPaths: Set<string>
  onToggle: (path: string) => void
}

function FileTreeItem({ node, selectedPath, onSelect, expandedPaths, onToggle }: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const isDirectory = node.type === 'directory'

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggle(node.path)
    } else {
      onSelect(node.path)
    }
  }, [isDirectory, node.path, onToggle, onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isDirectory ? 'directory' : 'file'} ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {isDirectory && (
          <span className={`file-tree-chevron ${isExpanded ? 'expanded' : ''}`}>
            ▶
          </span>
        )}
        {!isDirectory && <span className="file-tree-chevron-placeholder" />}

        <span className="file-tree-icon">
          {isDirectory
            ? (isExpanded ? '📂' : '📁')
            : getFileIcon(node.name)
          }
        </span>

        <span className="file-tree-name" title={node.name}>
          {node.name}
        </span>
      </div>

      {isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <div className="file-tree-children" role="group">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileTreeProps {
  tree: TreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function FileTree({ tree, selectedPath, onSelect }: FileTreeProps) {
  // Состояние раскрытых папок — вынесено на уровень дерева
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // По умолчанию раскрываем корневые директории
    const initial = new Set<string>()
    const addRootDirs = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          initial.add(node.path)
          if (node.children) addRootDirs(node.children)
        }
      }
    }
    addRootDirs(tree)
    return initial
  })

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Collapse all / Expand all
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set())
  }, [])

  const handleExpandAll = useCallback(() => {
    const all = new Set<string>()
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          all.add(node.path)
          if (node.children) collect(node.children)
        }
      }
    }
    collect(tree)
    setExpandedPaths(all)
  }, [tree])

  if (tree.length === 0) {
    return (
      <div className="file-tree-empty">
        <span className="empty-icon">📂</span>
        <p>Выберите репозиторий</p>
      </div>
    )
  }

  return (
    <div className="file-tree" role="tree">
      <div className="file-tree-actions">
        <button
          className="file-tree-action-btn"
          onClick={handleExpandAll}
          title="Развернуть все"
        >
          ⌄
        </button>
        <button
          className="file-tree-action-btn"
          onClick={handleCollapseAll}
          title="Свернуть все"
        >
          ⌃
        </button>
      </div>
      {tree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
        />
      ))}
    </div>
  )
}
