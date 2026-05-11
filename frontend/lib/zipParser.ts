import JSZip from 'jszip'
import type { Node, Edge } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'

interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'file'
  children: TreeNode[]
  depth: number
}

function fileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['ts', 'tsx'].includes(ext))          return '#3b82f6'
  if (['js', 'jsx'].includes(ext))          return '#f59e0b'
  if (['py'].includes(ext))                 return '#22c55e'
  if (['json', 'yaml', 'yml'].includes(ext)) return '#a78bfa'
  if (['css', 'scss', 'sass'].includes(ext)) return '#ec4899'
  if (['md', 'txt'].includes(ext))          return '#94a3b8'
  if (['html'].includes(ext))               return '#f97316'
  if (['png','jpg','svg','ico'].includes(ext)) return '#06b6d4'
  return '#6b7280'
}

function folderColor(depth: number): string {
  const colors = ['#14b8a6', '#a855f7', '#f97316', '#6366f1', '#ec4899']
  return colors[depth % colors.length]
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { id: 'root', name: 'root', type: 'folder', children: [], depth: 0 }

  for (const path of paths) {
    const parts = path.split('/').filter(Boolean)
    let current = root
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1
      const id = parts.slice(0, i + 1).join('/')
      let child = current.children.find(c => c.name === part)
      if (!child) {
        child = {
          id,
          name: part,
          type: isLast && !path.endsWith('/') ? 'file' : 'folder',
          children: [],
          depth: i + 1,
        }
        current.children.push(child)
      }
      current = child
    })
  }
  return root
}

// Radial layout — children fan out around parent
function layoutTree(
  tree: TreeNode,
  cx: number,
  cy: number,
  angleStart: number,
  angleEnd: number,
  radius: number,
  nodes: Node[],
  edges: Edge[],
  maxDepth = 4,
) {
  if (tree.depth > maxDepth) return

  const children = tree.children
    .filter(c => c.type === 'folder' || tree.depth < 2)  // only show files at depth ≥ 2
    .slice(0, 12)  // max 12 children

  if (children.length === 0) return

  const angleStep = (angleEnd - angleStart) / children.length

  children.forEach((child, i) => {
    const angle = angleStart + angleStep * i + angleStep / 2
    const rad = (angle * Math.PI) / 180
    const x = cx + Math.cos(rad) * radius
    const y = cy + Math.sin(rad) * radius
    const color = child.type === 'folder' ? folderColor(child.depth) : fileColor(child.name)
    const icon = child.type === 'folder' ? '📁' : getFileIcon(child.name)
    const extraCount = child.children.length > 12 ? child.children.length - 12 : 0

    nodes.push({
      id: child.id,
      type: 'zipNode',
      position: { x: x - 70, y: y - 18 },
      data: { label: child.name, type: child.type, color, icon, depth: child.depth, extraCount },
    })

    edges.push({
      id: `e-${tree.id}-${child.id}`,
      source: tree.id === 'root' ? 'center' : tree.id,
      target: child.id,
      type: 'natural',
      style: { stroke: color, strokeWidth: 1, opacity: 0.45 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 7, height: 7 },
    })

    if (child.type === 'folder' && child.depth < maxDepth) {
      const spreadAngle = Math.min(angleStep * 0.85, 90)
      layoutTree(child, x, y, angle - spreadAngle / 2, angle + spreadAngle / 2, radius * 0.75, nodes, edges, maxDepth)
    }
  })
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['ts', 'tsx'].includes(ext)) return '📘'
  if (['js', 'jsx'].includes(ext)) return '📙'
  if (['py'].includes(ext))        return '🐍'
  if (['json'].includes(ext))      return '📋'
  if (['md'].includes(ext))        return '📝'
  if (['css', 'scss'].includes(ext)) return '🎨'
  if (['html'].includes(ext))      return '🌐'
  if (['png','jpg','svg'].includes(ext)) return '🖼️'
  return '📄'
}

export async function parseZip(
  file: File,
  cx = 600,
  cy = 400,
): Promise<{ nodes: Node[]; edges: Edge[]; rootName: string }> {
  const zip = await JSZip.loadAsync(file)
  const paths = Object.keys(zip.files)

  const tree = buildTree(paths)
  const rootName = file.name.replace(/\.zip$/i, '')

  const nodes: Node[] = []
  const edges: Edge[] = []

  layoutTree(tree, cx, cy, -180, 180, 280, nodes, edges)

  return { nodes, edges, rootName }
}
