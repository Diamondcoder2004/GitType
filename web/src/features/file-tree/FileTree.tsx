import { useState } from 'react'
import { TreeNode } from '../../core/repository/treeBuilder'
import './FileTree.css'

interface FileTreeItemProps {
  node: TreeNode
  level: number
  selectedPath: string | null
  onSelect: (path: string) => void
}

function FileTreeItem({ node, level, selectedPath, onSelect }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isSelected = selectedPath === node.path
  const paddingLeft = level * 16 + 8

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded)
    } else {
      onSelect(node.path)
    }
  }

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${node.type} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        <span className="icon">
          {node.type === 'directory' ? (
            isExpanded ? (
              '📂'
            ) : (
              '📁'
            )
          ) : (
            '📄'
          )}
        </span>
        <span className="name">{node.name}</span>
      </div>

      {node.type === 'directory' && isExpanded && node.children && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
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
  if (tree.length === 0) {
    return (
      <div className="file-tree-empty">
        Введите репозиторий и нажмите ↻
      </div>
    )
  }

  return (
    <div className="file-tree">
      {tree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          level={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
