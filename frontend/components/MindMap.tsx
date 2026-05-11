'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Handle,
  Position,
  NodeProps,
  EdgeProps,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAgentStore, AgentMessage } from '@/lib/store'
import CodeBlock from './CodeBlock'

// ─── Constants ────────────────────────────────────────────────────────────────
const CX = 600, CY = 400
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)

// ─── Agent styling ────────────────────────────────────────────────────────────
function getAgentStyle(agent: string) {
  if (agent.startsWith('Groq'))        return { bg: '#0c1a3e', color: '#3b82f6', icon: '🦙' }
  if (agent.startsWith('Gemini'))      return { bg: '#0c2340', color: '#38bdf8', icon: '🔷' }
  if (agent.startsWith('Mistral'))     return { bg: '#3a1800', color: '#fb923c', icon: '🌊' }
  if (agent.startsWith('OpenRouter'))  return { bg: '#0a2e1a', color: '#34d399', icon: '🔀' }
  if (agent === 'Judge')               return { bg: '#3b2a00', color: '#eab308', icon: '⚖️' }
  if (agent === 'Agent A')             return { bg: '#2d1b00', color: '#f97316', icon: '🔵' }
  if (agent === 'Agent B')             return { bg: '#0a2040', color: '#06b6d4', icon: '🟠' }
  if (agent === 'Project Manager')     return { bg: '#134e4a', color: '#14b8a6', icon: '📋' }
  if (agent === 'Self Improver')       return { bg: '#4c0519', color: '#f43f5e', icon: '🧠' }
  if (agent === 'Synthesizer')         return { bg: '#2e1065', color: '#a78bfa', icon: '✨' }
  if (agent === 'Debate')              return { bg: '#431407', color: '#f97316', icon: '💬' }
  if (agent === 'Collaboration')       return { bg: '#1a1a2e', color: '#6366f1', icon: '🤝' }
  return { bg: '#1f2937', color: '#9ca3af', icon: '🤖' }
}

function parseMessage(message: string) {
  const parts: { type: 'text' | 'code'; content: string; language?: string }[] = []
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(message)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: message.slice(lastIndex, match.index) })
    parts.push({ type: 'code', content: match[2].trim(), language: match[1] || 'typescript' })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < message.length) parts.push({ type: 'text', content: message.slice(lastIndex) })
  return parts.length > 0 ? parts : [{ type: 'text' as const, content: message }]
}

// ─── Handle style ─────────────────────────────────────────────────────────────
const H = { opacity: 0, width: 1, height: 1, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }

// ─── Center node ──────────────────────────────────────────────────────────────
function CenterNode({ data }: NodeProps) {
  const d = data as any
  const hasGoal = d.hasGoal
  return (
    <div
      className="rounded-2xl px-6 py-4 text-white text-sm font-bold max-w-[220px] text-center cursor-default select-none"
      style={{
        background: '#030712',
        border: `2px solid ${hasGoal ? '#22c55e' : '#3b82f6'}`,
        boxShadow: `0 0 32px ${hasGoal ? '#22c55e55' : '#3b82f666'}`,
        transition: 'border-color 0.6s, box-shadow 0.6s',
      }}
    >
      <div className="text-xs mb-1 font-normal uppercase tracking-widest"
           style={{ color: hasGoal ? '#22c55e' : '#3b82f6' }}>
        Projekt
      </div>
      <div style={{ transition: 'all 0.4s' }}>{d.label}</div>
      <Handle type="source" position={Position.Top} style={H} />
    </div>
  )
}

// ─── Agent node ───────────────────────────────────────────────────────────────
function AgentNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div
      className={`rounded-lg p-2.5 text-white text-[11px] w-[170px] cursor-pointer transition-all hover:brightness-125 ${d.thinking ? 'opacity-60' : ''}`}
      style={{
        background: d.bg,
        border: d.isSelected ? `2px solid white` : `1px solid ${d.color}`,
        boxShadow: d.isSelected ? `0 0 0 3px ${d.color}, 0 0 20px ${d.color}99` : `0 0 10px ${d.color}44`,
        animation: 'nodeAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={H} />
      <div className="font-bold mb-1 flex items-center gap-1">
        <span>{d.icon}</span>
        <span className="truncate">{d.agentName}</span>
        {d.thinking
          ? <span className="ml-auto animate-pulse text-gray-400">•••</span>
          : d.isSelected
            ? <span className="ml-auto text-[9px]">📌</span>
            : <span className="ml-auto text-gray-600 text-[9px]">↗</span>
        }
      </div>
      {!d.thinking && (
        <div className="text-gray-300 text-[10px] leading-relaxed"
             style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {d.preview}
        </div>
      )}
    </div>
  )
}

// ─── Natural curved edge ──────────────────────────────────────────────────────
function NaturalEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd }: EdgeProps) {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const offset = len * 0.15
  const px = (-dy / len) * offset
  const py = ( dx / len) * offset
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2
  return (
    <path
      d={`M ${sourceX} ${sourceY} Q ${mx + px} ${my + py} ${targetX} ${targetY}`}
      fill="none"
      style={style}
      markerEnd={markerEnd as string}
      strokeLinecap="round"
    />
  )
}

// ─── ZIP folder/file node ─────────────────────────────────────────────────────
function ZipNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div
      className="rounded-lg px-2.5 py-1.5 text-white text-[11px] flex items-center gap-1.5 max-w-[160px] cursor-default"
      style={{
        background: '#0d1117',
        border: `1px solid ${d.color}`,
        boxShadow: `0 0 8px ${d.color}33`,
        animation: 'nodeAppear 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={H} />
      <span className="flex-shrink-0">{d.icon}</span>
      <span className="truncate font-medium" style={{ color: d.color }}>{d.label}</span>
      {d.extraCount > 0 && <span className="text-gray-500 text-[9px] flex-shrink-0">+{d.extraCount}</span>}
      <Handle type="source" position={Position.Top} style={H} />
    </div>
  )
}

const nodeTypes = { center: CenterNode, agent: AgentNode, zipNode: ZipNode }
const edgeTypes  = { natural: NaturalEdge }

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ agent, message, color, icon, onClose }: {
  agent: string; message: string; color: string; icon: string; onClose: () => void
}) {
  return (
    <div className="absolute top-0 right-0 h-full w-[420px] z-50 flex flex-col shadow-2xl"
         style={{ background: '#0d1117', borderLeft: `2px solid ${color}` }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800" style={{ background: '#111827' }}>
        <span className="text-xl">{icon}</span>
        <span className="font-bold text-white text-sm flex-1 truncate">{agent}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none px-1">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-gray-200 text-sm">
        {parseMessage(message).map((part, i) =>
          part.type === 'code'
            ? <CodeBlock key={i} code={part.content} language={part.language} />
            : <pre key={i} className="whitespace-pre-wrap font-sans leading-relaxed mb-2">{part.content}</pre>
        )}
      </div>
    </div>
  )
}

// ─── Controls ─────────────────────────────────────────────────────────────────
function MapControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const btn = "w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-bold transition-colors border border-gray-700"
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
      <button className={btn} onClick={() => zoomIn()}>+</button>
      <button className={btn} onClick={() => zoomOut()}>−</button>
      <button className={btn} onClick={() => fitView({ padding: 0.2 })}>⊡</button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MindMapInner() {
  const { messages, goal, projectName, selectedNodeAgent, setSelectedNodeAgent, zipNodes, zipEdges } = useAgentStore()
  const [detail, setDetail] = useState<{ agent: string; message: string; color: string; icon: string } | null>(null)

  // Persist positions across renders — golden angle spiral
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const counterRef = useRef(0)

  function getPosition(agentId: string): { x: number; y: number } {
    if (positionsRef.current.has(agentId)) return positionsRef.current.get(agentId)!
    const idx = counterRef.current++
    const radius = 260 + Math.floor(idx / 7) * 100
    const angle = idx * GOLDEN_ANGLE
    const pos = { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius }
    positionsRef.current.set(agentId, pos)
    return pos
  }

  const fullMessages = useMemo(() => {
    const map = new Map<string, AgentMessage>()
    for (const msg of messages) {
      if (!['System'].includes(msg.agent)) map.set(msg.agent, msg)
    }
    return map
  }, [messages])

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type !== 'agent') return
    const d = node.data as any
    if (d.thinking) return
    if (event.ctrlKey || event.metaKey) {
      setSelectedNodeAgent(selectedNodeAgent === d.agentName ? null : d.agentName)
    } else {
      const full = fullMessages.get(d.agentName)
      if (!full) return
      setDetail({ agent: d.agentName, message: full.message, color: d.color, icon: d.icon })
    }
  }, [fullMessages, selectedNodeAgent, setSelectedNodeAgent])

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const hasGoal = !!goal
    const label = projectName || 'Projekt benennen…'
    const centerLabel = label.length > 50 ? label.slice(0, 50) + '…' : label

    // Center node
    nodes.push({
      id: 'center',
      type: 'center',
      position: { x: CX - 110, y: CY - 40 },
      data: { label: centerLabel, hasGoal },
    })

    // One node per agent (latest message)
    const latestByAgent = new Map<string, AgentMessage>()
    for (const msg of messages) {
      if (msg.agent === 'System') continue
      latestByAgent.set(msg.agent, msg)
    }

    for (const msg of latestByAgent.values()) {
      const style = getAgentStyle(msg.agent)
      const thinking = msg.message.endsWith('...') && msg.message.length < 80
      const nodeId = `agent-${msg.agent.replace(/[^a-z0-9]/gi, '-')}`
      const pos = getPosition(nodeId)

      nodes.push({
        id: nodeId,
        type: 'agent',
        position: { x: pos.x - 85, y: pos.y - 40 },
        data: {
          agentName: msg.agent,
          preview: msg.message.slice(0, 160),
          thinking,
          isSelected: selectedNodeAgent === msg.agent,
          ...style,
        },
      })

      edges.push({
        id: `e-${nodeId}`,
        source: 'center',
        target: nodeId,
        type: 'natural',
        style: { stroke: style.color, strokeWidth: 1.2, opacity: 0.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color, width: 8, height: 8 },
      })
    }

    // Merge ZIP nodes/edges if present
    return {
      nodes: [...nodes, ...zipNodes],
      edges: [...edges, ...zipEdges],
    }
  }, [messages, goal, projectName, selectedNodeAgent, zipNodes, zipEdges])

  return (
    <>
      <style>{`
        @keyframes nodeAppear {
          from { opacity: 0; transform: scale(0.2); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div className="relative w-full h-full" style={{ background: '#030712' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#0f172a" gap={32} size={1} />
          <MapControls />
        </ReactFlow>
        {detail && (
          <DetailPanel
            agent={detail.agent}
            message={detail.message}
            color={detail.color}
            icon={detail.icon}
            onClose={() => setDetail(null)}
          />
        )}
      </div>
    </>
  )
}

export default function MindMap() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  )
}
