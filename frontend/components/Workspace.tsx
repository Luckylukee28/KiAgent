'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Handle,
  Position,
  NodeProps,
  EdgeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { useAgentStore, AgentMessage } from '@/lib/store'
import {
  CLUSTERS,
  CENTER,
  CARD_W,
  CARD_H,
  placeAgentsInClusters,
  clusterForCategory,
} from '@/lib/workspaceConfig'
import CodeBlock from './CodeBlock'

// ─── Agent metadata ──────────────────────────────────────────────────────────
type AgentMeta = { role: string; category: string; icon: string; accent: string }

function getAgentMeta(agent: string): AgentMeta {
  if (agent.startsWith('Groq'))                      return { role: 'Llama 3.1 — fast',         category: 'CODER',    icon: '◇', accent: '#22d3ee' }
  if (agent.startsWith('Gemini') && agent !== 'Synthesizer')
                                                     return { role: 'Gemini 2.0 — analytical',  category: 'CODER',    icon: '◇', accent: '#22d3ee' }
  if (agent.startsWith('Mistral'))                   return { role: 'Mistral — creative',       category: 'CODER',    icon: '◇', accent: '#22d3ee' }
  if (agent.startsWith('OpenRouter Reasoning'))      return { role: 'DeepSeek + reasoning',     category: 'CODER',    icon: '◈', accent: '#22d3ee' }
  if (agent.startsWith('OpenRouter'))                return { role: 'DeepSeek — versatile',     category: 'CODER',    icon: '◇', accent: '#22d3ee' }
  if (agent === 'Synthesizer')                       return { role: 'Merges all outputs',       category: 'SYNTHESE', icon: '◈', accent: '#a78bfa' }
  if (agent === 'Judge')                             return { role: 'Picks best approach',      category: 'REVIEW',   icon: '◉', accent: '#fbbf24' }
  if (agent === 'Self Improver')                     return { role: 'Iterative refinement',     category: 'REVIEW',   icon: '◉', accent: '#fbbf24' }
  if (agent === 'Project Manager')                   return { role: 'Plans project scope',      category: 'PLANUNG',  icon: '◐', accent: '#34d399' }
  if (agent === 'Collaboration')                     return { role: 'Coordinator',              category: 'PLANUNG',  icon: '◐', accent: '#34d399' }
  if (agent === 'Agent A' || agent === 'Agent B' || agent === 'Debate')
                                                     return { role: 'Debate participant',       category: 'DEBATTE',  icon: '◎', accent: '#f472b6' }
  return { role: 'Agent', category: 'REVIEW', icon: '◯', accent: '#94a3b8' }
}

function getBaseAgentName(agent: string): string {
  if (agent.startsWith('Project Manager')) return 'Project Manager'
  if (agent.startsWith('Self Improver'))   return 'Self Improver'
  if (agent.startsWith('Agent A'))         return 'Agent A'
  if (agent.startsWith('Agent B'))         return 'Agent B'
  return agent.split(/\s*[·\-—]\s*/)[0].trim()
}

// ─── Cluster zone (background, non-interactive) ──────────────────────────────
function ClusterZone({ data }: NodeProps) {
  const d = data as any
  return (
    <div
      style={{
        width: d.size.w,
        height: d.size.h,
        background: `linear-gradient(135deg, ${d.bgFrom} 0%, ${d.bgTo} 100%)`,
        border: `1px solid ${d.accent}1f`,
        borderRadius: 20,
        padding: '18px 22px',
        pointerEvents: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.9 }}>
        <span style={{ fontSize: 16, color: d.accent }}>{d.icon}</span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2.5,
          color: d.accent,
          textTransform: 'uppercase',
        }}>{d.label}</span>
      </div>
      <div style={{
        fontSize: 11,
        color: 'rgba(241, 245, 249, 0.4)',
        marginTop: 2,
        letterSpacing: 0.2,
      }}>{d.description}</div>
    </div>
  )
}

// ─── Project center (the spatial anchor) ──────────────────────────────────────
function ProjectCenter({ data }: NodeProps) {
  const d = data as any
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px 28px',
        minWidth: 240,
        maxWidth: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        textAlign: 'center',
      }}
    >
      <Handle type="source" position={Position.Top} id="out" style={H_CENTER} />
      <div style={{
        fontSize: 10,
        letterSpacing: 3,
        color: 'rgba(148, 163, 184, 0.7)',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginBottom: 8,
      }}>
        {d.hasGoal ? '● Active' : '○ Idle'}
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#f8fafc',
        letterSpacing: -0.2,
        wordBreak: 'break-word',
      }}>{d.label}</div>
    </motion.div>
  )
}

// ─── Agent card (the main interactive unit) ──────────────────────────────────
const H_CENTER: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
}

function AgentCard({ data, selected }: NodeProps) {
  const d = data as any
  const statusColor = d.thinking ? '#94a3b8' : d.accent
  const isActive = d.isSelected || selected

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      style={{
        width: CARD_W,
        height: CARD_H,
        background: isActive
          ? 'rgba(30, 41, 59, 0.85)'
          : 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isActive
          ? `1px solid ${d.accent}88`
          : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'pointer',
        opacity: d.thinking ? 0.6 : 1,
        boxShadow: isActive
          ? `0 12px 32px rgba(0,0,0,0.4), 0 0 0 4px ${d.accent}1a`
          : '0 8px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02)',
        transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Top} id="in"  style={H_CENTER} />
      <Handle type="source" position={Position.Top} id="out" style={H_CENTER} />

      {/* Top row: icon + name + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 14,
          color: d.accent,
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: `${d.accent}14`,
          flexShrink: 0,
        }}>{d.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#f1f5f9',
            letterSpacing: -0.1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{d.agentName}</div>
          <div style={{
            fontSize: 10,
            color: 'rgba(148, 163, 184, 0.7)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{d.role}</div>
        </div>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: statusColor,
          boxShadow: d.thinking ? 'none' : `0 0 8px ${statusColor}`,
          flexShrink: 0,
          animation: d.thinking ? 'pulse 1.5s infinite' : 'none',
        }} />
      </div>

      {/* Phase chips */}
      {d.phases && d.phases.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {d.phases.slice(0, 3).map((p: string) => (
            <span key={p} style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: 'rgba(241,245,249,0.6)',
              background: 'rgba(255,255,255,0.04)',
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}>{p}</span>
          ))}
          {d.phases.length > 3 && (
            <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', alignSelf: 'center' }}>
              +{d.phases.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Preview text */}
      {!d.thinking && d.preview && (
        <div style={{
          flex: 1,
          fontSize: 10.5,
          lineHeight: 1.45,
          color: 'rgba(203, 213, 225, 0.55)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties}>{d.preview}</div>
      )}
    </motion.div>
  )
}

// ─── Edge: thin, low-opacity, accent-color on hover/selected ─────────────────
function QuietEdge({ sourceX, sourceY, targetX, targetY, style, selected }: EdgeProps) {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const cx1 = sourceX + dx * 0.5
  const cy1 = sourceY
  const cx2 = sourceX + dx * 0.5
  const cy2 = targetY
  return (
    <path
      d={`M ${sourceX} ${sourceY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${targetX} ${targetY}`}
      fill="none"
      style={{
        ...style,
        strokeWidth: selected ? 1.8 : 1,
        opacity: selected ? 0.6 : 0.2,
        transition: 'opacity 0.2s, stroke-width 0.2s',
      } as React.CSSProperties}
      strokeLinecap="round"
    />
  )
}

const NODE_TYPES = Object.freeze({ cluster: ClusterZone, center: ProjectCenter, agent: AgentCard })
const EDGE_TYPES = Object.freeze({ quiet: QuietEdge })

// ─── Detail panel (focus mode) ───────────────────────────────────────────────
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

function DetailPanel({ agent, message, accent, icon, onClose }: {
  agent: string; message: string; accent: string; icon: string; onClose: () => void
}) {
  return (
    <motion.div
      initial={{ x: 440, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 440, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 right-0 h-full w-[440px] z-50 flex flex-col shadow-2xl"
      style={{
        background: 'rgba(10, 14, 26, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <span style={{
          fontSize: 16,
          color: accent,
          width: 32, height: 32,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}14`, borderRadius: 8,
        }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">{agent}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Agent Output</div>
        </div>
        <button onClick={onClose}
                className="text-slate-500 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-white/5 transition-colors">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 text-slate-200 text-sm">
        {parseMessage(message).map((part, i) =>
          part.type === 'code'
            ? <CodeBlock key={i} code={part.content} language={part.language} />
            : <pre key={i} className="whitespace-pre-wrap font-sans leading-relaxed mb-3 text-slate-300">{part.content}</pre>
        )}
      </div>
    </motion.div>
  )
}

// ─── Map controls (floating) ─────────────────────────────────────────────────
function WorkspaceControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const btn = "w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white text-sm font-medium transition-all"
  const btnStyle = {
    background: 'rgba(15, 23, 42, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.05)',
  } as React.CSSProperties
  return (
    <div className="absolute bottom-5 left-5 z-10 flex flex-col gap-1">
      <button className={btn} style={btnStyle} onClick={() => zoomIn()}>+</button>
      <button className={btn} style={btnStyle} onClick={() => zoomOut()}>−</button>
      <button className={btn} style={btnStyle} onClick={() => fitView({ padding: 0.2, duration: 500 })}>⊡</button>
    </div>
  )
}

// ─── Main workspace ──────────────────────────────────────────────────────────
function WorkspaceInner() {
  const { messages, goal, projectName, selectedNodeAgent, setSelectedNodeAgent } = useAgentStore()
  const [detail, setDetail] = useState<{ agent: string; message: string; accent: string; icon: string } | null>(null)
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null)

  // Build base-name-grouped agent list with combined message and phases
  const agentEntries = useMemo(() => {
    const byBase = new Map<string, AgentMessage[]>()
    for (const msg of messages) {
      if (msg.agent === 'System') continue
      const base = getBaseAgentName(msg.agent)
      if (!byBase.has(base)) byBase.set(base, [])
      byBase.get(base)!.push(msg)
    }
    return [...byBase.entries()].map(([base, msgs]) => {
      const latest = msgs[msgs.length - 1]
      const phaseSet = new Set<string>()
      msgs.forEach(m => {
        const parts = m.agent.split(/\s*[·\-—]\s*/)
        if (parts.length > 1) phaseSet.add(parts.slice(1).join(' ').trim())
      })
      return {
        base,
        latest,
        phases: [...phaseSet],
        combined: msgs.map(m => m.message).join('\n\n---\n\n'),
        meta: getAgentMeta(base),
      }
    })
  }, [messages])

  // Spatial placement
  const placements = useMemo(() => {
    return placeAgentsInClusters(
      agentEntries.map(e => ({ base: e.base, category: e.meta.category }))
    )
  }, [agentEntries])

  const placementMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; clusterId: string }>()
    for (const p of placements) m.set(p.base, p.position && { ...p.position, clusterId: p.clusterId } as any)
    return m
  }, [placements])

  // Click handlers
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type !== 'agent') return
    const d = node.data as any
    if (event.ctrlKey || event.metaKey) {
      setSelectedNodeAgent(selectedNodeAgent === d.agentName ? null : d.agentName)
    } else {
      setDetail({ agent: d.agentName, message: d.fullMessage, accent: d.accent, icon: d.icon })
    }
  }, [selectedNodeAgent, setSelectedNodeAgent])

  // Build the React Flow nodes & edges
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // 1) Cluster zones first (lowest z)
    for (const c of CLUSTERS) {
      nodes.push({
        id: `cluster-${c.id}`,
        type: 'cluster',
        position: c.position,
        data: { ...c },
        draggable: false,
        selectable: false,
        zIndex: -10,
      })
    }

    // 2) Center node
    const centerLabel = (projectName || 'Workspace').slice(0, 60)
    nodes.push({
      id: 'center',
      type: 'center',
      position: { x: CENTER.x - 180, y: CENTER.y - 40 },  // center the card
      data: { label: centerLabel, hasGoal: !!goal },
      draggable: false,
      selectable: false,
    })

    // 3) Agent cards
    for (const entry of agentEntries) {
      const place = placementMap.get(entry.base)
      if (!place) continue
      const thinking = entry.latest.message.endsWith('...') && entry.latest.message.length < 80
      const nodeId = `agent-${entry.base.replace(/[^a-z0-9]/gi, '-')}`

      nodes.push({
        id: nodeId,
        type: 'agent',
        position: place,
        data: {
          agentName: entry.base,
          role: entry.meta.role,
          icon: entry.meta.icon,
          accent: entry.meta.accent,
          preview: entry.latest.message.slice(0, 140),
          fullMessage: entry.combined,
          phases: entry.phases,
          thinking,
          isSelected: selectedNodeAgent === entry.base,
        },
      })

      // Edge from center → agent (quiet, accent color)
      edges.push({
        id: `e-${nodeId}`,
        source: 'center',
        sourceHandle: 'out',
        target: nodeId,
        targetHandle: 'in',
        type: 'quiet',
        style: { stroke: entry.meta.accent },
      })
    }

    return { nodes, edges }
  }, [agentEntries, placementMap, goal, projectName, selectedNodeAgent])

  return (
    <div className="relative w-full h-full" style={{ background: '#05060d' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        .react-flow__attribution { display: none !important }
      `}</style>

      {/* Ambient background gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 40%, rgba(30,41,59,0.4) 0%, transparent 60%)',
      }} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'quiet' }}
      >
        <Background color="rgba(255,255,255,0.025)" gap={32} size={1} />
        <WorkspaceControls />
      </ReactFlow>

      {detail && (
        <DetailPanel
          agent={detail.agent}
          message={detail.message}
          accent={detail.accent}
          icon={detail.icon}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

export default function Workspace() {
  return (
    <ReactFlowProvider>
      <WorkspaceInner />
    </ReactFlowProvider>
  )
}
