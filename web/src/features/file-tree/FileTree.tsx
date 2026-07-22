import { useState, useCallback } from 'react'
import { TreeNode } from '../../core/repository/treeBuilder'
import { getFileIcon as getCatppuccinIcon, getFileIconColor } from '../../core/repository/fileIcons'
import './FileTree.css'

interface FileTreeItemProps {
  node: TreeNode
  selectedPath: string | null
  onSelect: (path: string) => void
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  completedFiles: string[]
}

function FileTreeItem({ node, selectedPath, onSelect, expandedPaths, onToggle, completedFiles }: FileTreeItemProps) {
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
            : (
              <span
                className="file-icon-badge"
                style={{ color: getFileIconColor(node.name), borderColor: getFileIconColor(node.name) + '44' }}
                title={node.name}
              >
                {getCatppuccinIcon(node.name).icon}
              </span>
            )
          }
        </span>

        <span className="file-tree-name" title={node.name}>
          {node.name}
        </span>

        {!isDirectory && completedFiles.includes(node.path) && (
          <span className="file-tree-completed" title="Изучено">✅</span>
        )}
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
              completedFiles={completedFiles}
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
  completedFiles: string[]
}

export function FileTree({ tree, selectedPath, onSelect, completedFiles }: FileTreeProps) {
  // Состояние раскрытых папок — вынесено на уровень дерева
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // По умолчанию раскрываем только корневые директории (без рекурсии)
    const initial = new Set<string>()
    for (const node of tree) {
      if (node.type === 'directory') {
        initial.add(node.path)
      }
    }
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
          completedFiles={completedFiles}
        />
      ))}
    </div>
  )
}
