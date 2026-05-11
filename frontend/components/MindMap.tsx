'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Handle,
  Position,
  NodeProps,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAgentStore, AgentMessage } from '@/lib/store'
import CodeBlock from './CodeBlock'

// ─── Layout constants ─────────────────────────────────────────────────────────
const CX = 700, CY = 420
const PHASE_R = 270
const AGENT_R = 510

// ─── Phase config ─────────────────────────────────────────────────────────────
const PHASES: Record<string, { label: string; icon: string; color: string; angle: number }> = {
  pm:              { label: 'Project Manager', icon: '📋', color: '#14b8a6', angle: -100 },
  debate:          { label: 'Debate',          icon: '💬', color: '#f97316', angle: -48  },
  architecture:    { label: 'Architektur',     icon: '🏗️', color: '#a855f7', angle: 4   },
  frontend:        { label: 'Frontend',        icon: '🎨', color: '#ec4899', angle: 56  },
  backend:         { label: 'Backend',         icon: '⚙️', color: '#6366f1', angle: 108 },
  'self-improver': { label: 'Self Improver',   icon: '🧠', color: '#f43f5e', angle: 160 },
  review:          { label: 'Review',          icon: '🔍', color: '#22c55e', angle: 212 },
}

function polar(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r }
}

function getPhaseKey(agent: string): string | null {
  if (agent === 'Project Manager') return 'pm'
  if (['Debate', 'Agent A', 'Agent B', 'Judge'].includes(agent)) return 'debate'
  if (agent.includes('Archit') || agent.includes('archit')) return 'architecture'
  if (agent.includes('Frontend') || agent.includes('frontend')) return 'frontend'
  if (agent.includes('Backend') || agent.includes('backend')) return 'backend'
  if (agent === 'Self Improver') return 'self-improver'
  if (agent.includes('Review') || agent.includes('review')) return 'review'
  return null
}

function getAgentStyle(agent: string) {
  if (agent.startsWith('Groq'))       return { bg: '#0c1a3e', color: '#3b82f6', icon: '🦙' }
  if (agent.startsWith('Gemini'))     return { bg: '#0c2340', color: '#38bdf8', icon: '🔷' }
  if (agent.startsWith('Mistral'))    return { bg: '#3a1800', color: '#fb923c', icon: '🌊' }
  if (agent.startsWith('OpenRouter')) return { bg: '#0a2e1a', color: '#34d399', icon: '🔀' }
  if (agent === 'Judge')              return { bg: '#3b2a00', color: '#eab308', icon: '⚖️' }
  if (agent === 'Agent A')            return { bg: '#2d1b00', color: '#f97316', icon: '🔵' }
  if (agent === 'Agent B')            return { bg: '#0a2040', color: '#06b6d4', icon: '🟠' }
  if (agent === 'Project Manager')    return { bg: '#134e4a', color: '#14b8a6', icon: '📋' }
  if (agent === 'Self Improver')      return { bg: '#4c0519', color: '#f43f5e', icon: '🧠' }
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

// ─── Custom nodes ─────────────────────────────────────────────────────────────
function CenterNode({ data }: NodeProps) {
  return (
    <div className="bg-gray-950 border-2 border-blue-500 rounded-2xl px-5 py-4 text-white text-sm font-bold max-w-[200px] text-center cursor-default"
         style={{ boxShadow: '0 0 24px #3b82f666' }}>
      <div className="text-blue-400 text-xs mb-1 font-normal uppercase tracking-wider">Aufgabe</div>
      {data.label as string}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function PhaseNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div className="rounded-xl px-3 py-2 text-white text-xs font-semibold flex items-center gap-1.5 cursor-default"
         style={{ background: '#111827', border: `1.5px solid ${d.color}`, boxShadow: `0 0 14px ${d.color}44` }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span>{d.icon}</span>
      <span>{d.label}</span>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function AgentNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div className={`rounded-lg p-2.5 text-white text-[11px] w-[170px] cursor-pointer hover:brightness-125 transition-all ${d.thinking ? 'opacity-70' : ''}`}
         style={{ background: d.bg, border: `1px solid ${d.color}`, boxShadow: `0 0 8px ${d.color}33` }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="font-bold mb-1 flex items-center gap-1">
        <span>{d.icon}</span>
        <span className="truncate">{d.agentName}</span>
        {d.thinking
          ? <span className="ml-auto animate-pulse text-gray-400">•••</span>
          : <span className="ml-auto text-gray-500 text-[9px]">↗</span>
        }
      </div>
      {!d.thinking && (
        <div className="text-gray-300 text-[10px] leading-relaxed"
             style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {d.preview}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { center: CenterNode, phase: PhaseNode, agent: AgentNode }

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ agent, message, color, icon, onClose }: {
  agent: string; message: string; color: string; icon: string; onClose: () => void
}) {
  return (
    <div className="absolute top-0 right-0 h-full w-[420px] z-50 flex flex-col shadow-2xl"
         style={{ background: '#0d1117', borderLeft: `2px solid ${color}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800"
           style={{ background: '#111827' }}>
        <span className="text-xl">{icon}</span>
        <span className="font-bold text-white text-sm flex-1 truncate">{agent}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl leading-none px-1 transition-colors"
        >×</button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 text-gray-200 text-sm">
        {parseMessage(message).map((part, i) =>
          part.type === 'code' ? (
            <CodeBlock key={i} code={part.content} language={part.language} />
          ) : (
            <pre key={i} className="whitespace-pre-wrap font-sans leading-relaxed mb-2">{part.content}</pre>
          )
        )}
      </div>
    </div>
  )
}

// ─── Custom Controls ──────────────────────────────────────────────────────────
function MapControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const btn = "w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-bold transition-colors border border-gray-700"
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
      <button className={btn} onClick={() => zoomIn()} title="Zoom in">+</button>
      <button className={btn} onClick={() => zoomOut()} title="Zoom out">−</button>
      <button className={btn} onClick={() => fitView({ padding: 0.15 })} title="Fit view">⊡</button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MindMapInner() {
  const { messages, goal, language } = useAgentStore()
  const [detail, setDetail] = useState<{ agent: string; message: string; color: string; icon: string } | null>(null)

  // Full messages by agent for the detail panel
  const fullMessages = useMemo(() => {
    const map = new Map<string, AgentMessage>()
    for (const msg of messages) {
      if (!['Collaboration', 'System'].includes(msg.agent)) map.set(msg.agent, msg)
    }
    return map
  }, [messages])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type !== 'agent') return
    const d = node.data as any
    const full = fullMessages.get(d.agentName)
    if (!full || d.thinking) return
    setDetail({ agent: d.agentName, message: full.message, color: d.color, icon: d.icon })
  }, [fullMessages])

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const centerLabel = goal
      ? (goal.length > 55 ? goal.slice(0, 55) + '…' : goal)
      : (language === 'de' ? 'Warte auf Aufgabe…' : 'Waiting for task…')

    nodes.push({
      id: 'center', type: 'center',
      position: { x: CX - 100, y: CY - 40 },
      data: { label: centerLabel },
    })

    for (const [key, cfg] of Object.entries(PHASES)) {
      const pos = polar(cfg.angle, PHASE_R)
      nodes.push({
        id: `phase-${key}`, type: 'phase',
        position: { x: pos.x - 75, y: pos.y - 18 },
        data: { label: cfg.label, icon: cfg.icon, color: cfg.color },
      })
      edges.push({
        id: `e-center-${key}`, source: 'center', target: `phase-${key}`,
        style: { stroke: cfg.color, strokeWidth: 1.5, opacity: 0.35 },
        type: 'smoothstep',
      })
    }

    const latestByAgent = new Map<string, AgentMessage>()
    for (const msg of messages) {
      if (['Collaboration', 'System', 'Synthesizer'].includes(msg.agent)) continue
      latestByAgent.set(msg.agent, msg)
    }

    const phaseAgents: Record<string, AgentMessage[]> = {}
    for (const msg of latestByAgent.values()) {
      const phase = getPhaseKey(msg.agent)
      if (!phase) continue
      if (!phaseAgents[phase]) phaseAgents[phase] = []
      phaseAgents[phase].push(msg)
    }

    for (const [phase, agentMsgs] of Object.entries(phaseAgents)) {
      const cfg = PHASES[phase]
      const total = agentMsgs.length
      const spread = (total - 1) * 28
      agentMsgs.forEach((msg, idx) => {
        const agentAngle = cfg.angle - spread / 2 + idx * 28
        const pos = polar(agentAngle, AGENT_R)
        const style = getAgentStyle(msg.agent)
        const thinking = msg.message.endsWith('...') && msg.message.length < 80
        const nodeId = `agent-${msg.agent.replace(/[^a-z0-9]/gi, '-')}`
        nodes.push({
          id: nodeId, type: 'agent',
          position: { x: pos.x - 85, y: pos.y - 45 },
          data: { agentName: msg.agent, preview: msg.message.slice(0, 160), thinking, ...style },
        })
        edges.push({
          id: `e-${nodeId}`, source: `phase-${phase}`, target: nodeId,
          style: { stroke: style.color, strokeWidth: 1, opacity: 0.45 },
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        })
      })
    }

    return { nodes, edges }
  }, [messages, goal, language])

  return (
    <div className="relative w-full h-full" style={{ background: '#030712' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f2937" gap={28} size={1} />
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
  )
}

export default function MindMap() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  )
}
