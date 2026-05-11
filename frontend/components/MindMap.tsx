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

// ─── Layout constants ─────────────────────────────────────────────────────────
const CX = 600
const CY = 380
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const BASE_RADIUS = 320       // distance center → first agent
const RING_STEP   = 160       // extra radius per spiral ring
const SUB_RADIAL  = 170       // distance agent center → sub-node center
const SUB_PERP    = 38        // perpendicular spacing between sub-nodes

// Centered hidden handle (lets edges connect from any direction)
const H_CENTER: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
}

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

// ─── Agent role & category ────────────────────────────────────────────────────
type AgentMeta = { role: string; category: string; categoryColor: string }

function getAgentMeta(agent: string): AgentMeta {
  if (agent.startsWith('Groq'))        return { role: 'Generiert Code (schnell)',    category: 'CODER',      categoryColor: '#3b82f6' }
  if (agent.startsWith('Gemini') && agent !== 'Synthesizer')
                                       return { role: 'Generiert Code (analytisch)', category: 'CODER',      categoryColor: '#3b82f6' }
  if (agent.startsWith('Mistral'))     return { role: 'Generiert Code (kreativ)',    category: 'CODER',      categoryColor: '#3b82f6' }
  if (agent.startsWith('OpenRouter'))  return { role: 'Generiert Code (DeepSeek)',   category: 'CODER',      categoryColor: '#3b82f6' }
  if (agent === 'Synthesizer')         return { role: 'Kombiniert alle Outputs',     category: 'SYNTHESE',   categoryColor: '#a78bfa' }
  if (agent === 'Judge')               return { role: 'Bewertet beste Lösung',       category: 'REVIEW',     categoryColor: '#eab308' }
  if (agent === 'Self Improver')       return { role: 'Iterative Verbesserung',      category: 'REVIEW',     categoryColor: '#eab308' }
  if (agent === 'Project Manager')     return { role: 'Plant Projektstruktur',       category: 'PLANUNG',    categoryColor: '#14b8a6' }
  if (agent === 'Agent A')             return { role: 'Position A in Debatte',       category: 'DEBATTE',    categoryColor: '#f97316' }
  if (agent === 'Agent B')             return { role: 'Position B in Debatte',       category: 'DEBATTE',    categoryColor: '#f97316' }
  if (agent === 'Debate')              return { role: 'Moderiert Diskussion',        category: 'DEBATTE',    categoryColor: '#f97316' }
  if (agent === 'Collaboration')       return { role: 'Koordiniert Agents',          category: 'PLANUNG',    categoryColor: '#14b8a6' }
  return { role: 'AI Agent', category: 'OTHER', categoryColor: '#9ca3af' }
}

// ─── Work areas (what did the agent actually produce?) ───────────────────────
const WORK_AREA_STYLES: Record<string, { color: string; icon: string }> = {
  'Frontend':   { color: '#06b6d4', icon: '🎨' },
  'Backend':    { color: '#22c55e', icon: '⚙️' },
  'API':        { color: '#fbbf24', icon: '🔌' },
  'Datenbank':  { color: '#a855f7', icon: '🗄️' },
  'Styling':    { color: '#ec4899', icon: '💅' },
  'Tests':      { color: '#fb923c', icon: '🧪' },
  'Config':     { color: '#94a3b8', icon: '🔧' },
  'Logik':      { color: '#6366f1', icon: '🧠' },
  'Allgemein':  { color: '#6b7280', icon: '📄' },
}

function detectWorkAreas(message: string): string[] {
  const areas = new Set<string>()

  // 1) Code blocks → language tells us the area
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = codeRe.exec(message)) !== null) {
    const lang = (m[1] || '').toLowerCase()
    const code = m[2] || ''
    if (['tsx', 'jsx', 'html', 'vue', 'svelte'].includes(lang))       areas.add('Frontend')
    else if (['py', 'python', 'go', 'rs', 'rust', 'java', 'rb', 'ruby', 'php'].includes(lang)) areas.add('Backend')
    else if (['css', 'scss', 'sass', 'less'].includes(lang))          areas.add('Styling')
    else if (['sql', 'mongodb', 'prisma'].includes(lang))             areas.add('Datenbank')
    else if (['json', 'yaml', 'yml', 'toml', 'env', 'ini'].includes(lang)) areas.add('Config')
    else if (['ts', 'js', 'typescript', 'javascript'].includes(lang)) {
      if (/\b(React|useState|useEffect|className|onClick|export default function)\b/.test(code)) areas.add('Frontend')
      else if (/\b(express|fastify|app\.(get|post|put|delete)|router\.|FastAPI|@app\.|async def)\b/.test(code)) areas.add('Backend')
      else if (/\b(describe|it\(|test\(|expect\()/.test(code))         areas.add('Tests')
      else                                                              areas.add('Logik')
    }
    else if (lang === 'bash' || lang === 'sh')                          areas.add('Config')
  }

  // 2) File path mentions
  const pathRe = /(?:^|\s|`|"|')([a-zA-Z][\w-]*\/[\w\-./]+\.\w+)/g
  while ((m = pathRe.exec(message)) !== null) {
    const p = m[1].toLowerCase()
    if (p.includes('/components/') || p.includes('/pages/') || p.includes('/app/') || /\.(tsx|jsx|vue|svelte|html)$/.test(p)) areas.add('Frontend')
    if (p.includes('/api/') || p.includes('/routes/') || /\.(py|go|rs|java|rb|php)$/.test(p)) areas.add('Backend')
    if (p.includes('test') || p.includes('spec'))                      areas.add('Tests')
    if (/\.(sql|prisma)$/.test(p))                                     areas.add('Datenbank')
    if (/\.(css|scss|sass|less)$/.test(p))                             areas.add('Styling')
    if (/\.(json|yaml|yml|toml|env|ini|config)$/.test(p))              areas.add('Config')
  }

  // 3) Keyword fallback
  if (areas.size === 0) {
    const lc = message.toLowerCase()
    if (/\b(frontend|ui|component|page|button|formular)\b/.test(lc))   areas.add('Frontend')
    if (/\b(backend|server|endpoint|controller)\b/.test(lc))           areas.add('Backend')
    if (/\b(api|rest|graphql|endpoint)\b/.test(lc))                    areas.add('API')
    if (/\b(database|datenbank|sql|mongo|schema)\b/.test(lc))          areas.add('Datenbank')
    if (/\b(style|styling|css|tailwind|design)\b/.test(lc))            areas.add('Styling')
    if (/\b(test|testing|spec|unit test|jest)\b/.test(lc))             areas.add('Tests')
  }

  if (areas.size === 0) areas.add('Allgemein')
  return [...areas].slice(0, 4)
}

// Strip phase suffix from agent name ("Gemini · Frontend" → "Gemini")
function getBaseAgentName(agent: string): string {
  if (agent.startsWith('Project Manager')) return 'Project Manager'
  if (agent.startsWith('Self Improver'))   return 'Self Improver'
  if (agent.startsWith('Agent A'))         return 'Agent A'
  if (agent.startsWith('Agent B'))         return 'Agent B'
  return agent.split(/\s*[·\-—]\s*/)[0].trim()
}

// Detect which agents collaborated based on which are present
function getCollaborations(agentNames: string[]): Array<{ from: string; to: string; color: string }> {
  const has = (n: string) => agentNames.some(a => a === n || a.startsWith(n))
  const find = (prefix: string) => agentNames.filter(a => a === prefix || a.startsWith(prefix))
  const links: Array<{ from: string; to: string; color: string }> = []

  // All coders → Synthesizer (Synthesizer combines their outputs)
  if (has('Synthesizer')) {
    ;['Groq', 'Mistral', 'OpenRouter'].forEach(prefix => {
      find(prefix).forEach(c => links.push({ from: c, to: 'Synthesizer', color: '#a78bfa' }))
    })
    // Gemini coders (not the Synthesizer itself which is Gemini-based)
    find('Gemini').filter(a => a !== 'Synthesizer').forEach(c =>
      links.push({ from: c, to: 'Synthesizer', color: '#a78bfa' })
    )
  }

  // Synthesizer → Judge
  if (has('Synthesizer') && has('Judge')) {
    links.push({ from: 'Synthesizer', to: 'Judge', color: '#eab308' })
  }

  // Judge → Self Improver (Self Improver acts on Judge's verdict)
  if (has('Judge') && has('Self Improver')) {
    links.push({ from: 'Judge', to: 'Self Improver', color: '#f43f5e' })
  }

  // Agent A ↔ Agent B (debate)
  if (has('Agent A') && has('Agent B')) {
    links.push({ from: 'Agent A', to: 'Agent B', color: '#f97316' })
  }

  // Debate moderates both agents
  if (has('Debate')) {
    if (has('Agent A')) links.push({ from: 'Debate', to: 'Agent A', color: '#f97316' })
    if (has('Agent B')) links.push({ from: 'Debate', to: 'Agent B', color: '#f97316' })
  }

  // Project Manager → all coders (PM plans the work)
  if (has('Project Manager')) {
    ;['Groq', 'Mistral', 'OpenRouter'].forEach(prefix => {
      find(prefix).forEach(c => links.push({ from: 'Project Manager', to: c, color: '#14b8a6' }))
    })
    find('Gemini').filter(a => a !== 'Synthesizer').forEach(c =>
      links.push({ from: 'Project Manager', to: c, color: '#14b8a6' })
    )
  }

  return links
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

// ─── Center node ──────────────────────────────────────────────────────────────
function CenterNode({ data }: NodeProps) {
  const d = data as any
  const color = d.hasGoal ? '#22c55e' : '#3b82f6'
  return (
    <div
      style={{
        background: '#0d1117',
        border: `2px solid ${color}`,
        boxShadow: `0 0 28px ${color}55`,
        borderRadius: 16,
        padding: '12px 26px',
        color: 'white',
        fontWeight: 700,
        fontSize: 15,
        minWidth: 140,
        maxWidth: 200,
        textAlign: 'center',
        cursor: 'default',
        userSelect: 'none',
        wordBreak: 'break-word',
        transition: 'border-color 0.5s, box-shadow 0.5s',
      }}
    >
      <Handle type="source" position={Position.Top} id="out" style={H_CENTER} />
      {d.label}
    </div>
  )
}

// ─── Agent node (pill with category + role) ───────────────────────────────────
function AgentNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div
      style={{
        background: d.bg,
        border: d.isSelected ? `2px solid #ffffff` : `1.5px solid ${d.color}`,
        boxShadow: d.isSelected
          ? `0 0 0 3px ${d.color}88, 0 0 20px ${d.color}66`
          : `0 0 14px ${d.color}44`,
        borderRadius: 12,
        padding: '8px 12px 9px',
        width: 200,
        color: 'white',
        cursor: 'pointer',
        opacity: d.thinking ? 0.55 : 1,
        animation: 'nodeAppear 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <Handle type="target" position={Position.Top} id="in"  style={H_CENTER} />
      <Handle type="source" position={Position.Top} id="out" style={H_CENTER} />

      {/* Name + status */}
      <div style={{ fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <span>{d.icon}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.agentName}
        </span>
        {d.thinking
          ? <span style={{ color: '#6b7280', fontSize: 10, animation: 'pulse 1.2s infinite' }}>•••</span>
          : d.isSelected
            ? <span style={{ fontSize: 9 }}>📌</span>
            : <span style={{ color: '#4b5563', fontSize: 9 }}>↗</span>
        }
      </div>

      {/* Role */}
      <div style={{ fontSize: 9.5, color: d.color, fontStyle: 'italic', marginBottom: d.thinking ? 0 : 4 }}>
        {d.role}
      </div>

      {/* Preview */}
      {!d.thinking && (
        <div style={{
          fontSize: 10,
          color: '#9ca3af',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          paddingTop: 4,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        } as React.CSSProperties}>
          {d.preview}
        </div>
      )}
    </div>
  )
}

// ─── Smooth curve edge (works in any direction) ──────────────────────────────
function SmoothEdge({ sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const offset = len * 0.12
  const px = (-dy / len) * offset
  const py = ( dx / len) * offset
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2
  return (
    <path
      d={`M ${sourceX} ${sourceY} Q ${mx + px} ${my + py} ${targetX} ${targetY}`}
      fill="none"
      style={style}
      strokeLinecap="round"
    />
  )
}

// ─── Natural curved edge (used by ZIP nodes) ──────────────────────────────────
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

// ─── Work area node (small pill: Frontend / Backend / etc.) ──────────────────
function WorkAreaNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div
      style={{
        background: '#0d1117',
        border: `1px solid ${d.color}`,
        boxShadow: `0 0 6px ${d.color}33`,
        borderRadius: 999,
        padding: '4px 11px',
        color: 'white',
        fontSize: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        width: 115,
        animation: 'nodeAppear 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" style={H_CENTER} />
      <span style={{ flexShrink: 0 }}>{d.icon}</span>
      <span style={{ fontWeight: 600, color: d.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {d.label}
      </span>
    </div>
  )
}

// ─── ZIP folder/file node ─────────────────────────────────────────────────────
function ZipNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div
      style={{
        background: '#0d1117',
        border: `1px solid ${d.color}`,
        boxShadow: `0 0 8px ${d.color}33`,
        borderRadius: 8,
        padding: '5px 10px',
        color: 'white',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: 160,
        animation: 'nodeAppear 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <span style={{ flexShrink: 0 }}>{d.icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: d.color }}>
        {d.label}
      </span>
      {d.extraCount > 0 && <span style={{ color: '#6b7280', fontSize: 9, flexShrink: 0 }}>+{d.extraCount}</span>}
      <Handle type="source" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  )
}

const nodeTypes = { center: CenterNode, agent: AgentNode, zipNode: ZipNode, workArea: WorkAreaNode }
const edgeTypes  = { smooth: SmoothEdge, natural: NaturalEdge }

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
      <button className={btn} onClick={() => fitView({ padding: 0.25, duration: 400 })}>⊡</button>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  const items: Array<[string, string]> = [
    ['Frontend', 'UI / Components'],
    ['Backend',  'Server / Routes'],
    ['API',      'Endpoints'],
    ['Datenbank','SQL / Schema'],
    ['Styling',  'CSS / Tailwind'],
    ['Tests',    'Unit / E2E'],
    ['Config',   'JSON / YAML'],
    ['Logik',    'Geschäftslogik'],
  ]
  return (
    <div className="absolute bottom-4 right-4 z-10 rounded-lg p-3 text-[10px]"
         style={{ background: 'rgba(13,17,23,0.85)', border: '1px solid #1f2937', backdropFilter: 'blur(6px)' }}>
      <div className="text-gray-400 font-bold mb-1.5 tracking-wider">ARBEITSBEREICHE</div>
      {items.map(([key, desc]) => {
        const wa = WORK_AREA_STYLES[key]
        if (!wa) return null
        return (
          <div key={key} className="flex items-center gap-2 py-0.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: wa.color, flexShrink: 0 }} />
            <span style={{ color: wa.color, fontWeight: 700, width: 64 }}>{key}</span>
            <span className="text-gray-500">{desc}</span>
          </div>
        )
      })}
      <div className="border-t border-gray-800 mt-2 pt-2 flex items-center gap-2">
        <svg width="20" height="6">
          <line x1="0" y1="3" x2="20" y2="3" stroke="#9ca3af" strokeWidth="1.2" strokeDasharray="3 2" />
        </svg>
        <span className="text-gray-500">Zusammenarbeit</span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MindMapInner() {
  const { messages, goal, projectName, selectedNodeAgent, setSelectedNodeAgent, zipNodes, zipEdges } = useAgentStore()
  const [detail, setDetail] = useState<{ agent: string; message: string; color: string; icon: string } | null>(null)

  // Persistent positions — once an agent is placed, it stays there
  const posRef = useRef<Map<string, { x: number; y: number; angle: number }>>(new Map())
  const counterRef = useRef(0)

  function getAgentPos(base: string): { x: number; y: number; angle: number } {
    const existing = posRef.current.get(base)
    if (existing) return existing
    const idx = counterRef.current++
    const ring = Math.floor(idx / 6)
    const radius = BASE_RADIUS + ring * RING_STEP
    const angle = idx * GOLDEN_ANGLE
    const pos = {
      x: CX + Math.cos(angle) * radius,
      y: CY + Math.sin(angle) * radius,
      angle,
    }
    posRef.current.set(base, pos)
    return pos
  }

  // Combined messages per base agent (concatenates all phase outputs)
  const fullMessages = useMemo(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.agent === 'System') continue
      const base = getBaseAgentName(msg.agent)
      const phase = msg.agent.split(/\s*[·\-—]\s*/).slice(1).join(' ').trim()
      const header = phase ? `### ${phase}\n\n` : ''
      const existing = map.get(base) || ''
      map.set(base, existing ? `${existing}\n\n---\n\n${header}${msg.message}` : `${header}${msg.message}`)
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
      setDetail({ agent: d.agentName, message: full, color: d.color, icon: d.icon })
    }
  }, [fullMessages, selectedNodeAgent, setSelectedNodeAgent])

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const rawLabel = projectName || 'Projekt'
    const label = rawLabel.length > 40 ? rawLabel.slice(0, 40) + '…' : rawLabel

    nodes.push({
      id: 'center',
      type: 'center',
      position: { x: CX - 97, y: CY - 24 },
      data: { label, hasGoal: !!goal },
    })

    // ─── Group messages by BASE agent (strip " · Phase" suffix) ─────────────
    // Backend may emit "Gemini · Frontend" and "Gemini · Backend" — these
    // are the SAME agent, just different work phases. Merge them.
    type AgentEntry = {
      base: string
      latest: AgentMessage
      phases: string[]            // ["Frontend", "Backend", ...]
      combinedMessage: string
    }

    const byBase = new Map<string, AgentMessage[]>()
    for (const msg of messages) {
      if (msg.agent === 'System') continue
      const baseName = getBaseAgentName(msg.agent)
      if (!byBase.has(baseName)) byBase.set(baseName, [])
      byBase.get(baseName)!.push(msg)
    }

    const agentList: AgentEntry[] = []
    byBase.forEach((msgs, base) => {
      const latest = msgs[msgs.length - 1]
      const phases = new Set<string>()
      msgs.forEach(m => {
        const parts = m.agent.split(/\s*[·\-—]\s*/)
        if (parts.length > 1) {
          const phase = parts.slice(1).join(' ').trim()
          if (phase) phases.add(phase)
        }
      })
      agentList.push({
        base,
        latest,
        phases: [...phases],
        combinedMessage: msgs.map(m => m.message).join('\n\n'),
      })
    })

    // Normalize phase name → known work area key
    function normalizePhase(phase: string): string {
      const p = phase.toLowerCase()
      if (p.includes('frontend') || p.includes('ui'))         return 'Frontend'
      if (p.includes('backend') || p.includes('server'))      return 'Backend'
      if (p.includes('api') || p.includes('endpoint'))        return 'API'
      if (p.includes('database') || p.includes('datenbank') || p.includes('sql')) return 'Datenbank'
      if (p.includes('style') || p.includes('css') || p.includes('design'))       return 'Styling'
      if (p.includes('test'))                                  return 'Tests'
      if (p.includes('config'))                                return 'Config'
      if (p.includes('logik') || p.includes('logic'))          return 'Logik'
      return phase
    }

    // ─── Free-form placement: each agent gets a persistent golden-angle slot ─
    const AGENT_W = 200, AGENT_H = 80
    const SUB_W = 115,   SUB_H = 26

    agentList.forEach(entry => {
      const { base, latest, phases, combinedMessage } = entry
      const style = getAgentStyle(base)
      const meta = getAgentMeta(base)
      const thinking = latest.message.endsWith('...') && latest.message.length < 80
      const nodeId = `agent-${base.replace(/[^a-z0-9]/gi, '-')}`
      const pos = getAgentPos(base)

      nodes.push({
        id: nodeId,
        type: 'agent',
        position: { x: pos.x - AGENT_W / 2, y: pos.y - AGENT_H / 2 },
        data: {
          agentName: base,
          preview: latest.message.slice(0, 120),
          role: meta.role,
          category: meta.category,
          categoryColor: meta.categoryColor,
          thinking,
          isSelected: selectedNodeAgent === base,
          ...style,
        },
      })

      edges.push({
        id: `e-${nodeId}`,
        source: 'center',
        sourceHandle: 'out',
        target: nodeId,
        targetHandle: 'in',
        type: 'smooth',
        style: { stroke: style.color, strokeWidth: 2, opacity: 0.6 },
      })

      // ── Work-area sub-nodes fan out from the agent away from center ────
      if (!thinking) {
        const phaseAreas = phases.map(normalizePhase)
        const detected = detectWorkAreas(combinedMessage)
        const areas = [...new Set([...phaseAreas, ...detected])].slice(0, 4)

        const out_x  = Math.cos(pos.angle)
        const out_y  = Math.sin(pos.angle)
        const perp_x = -out_y
        const perp_y =  out_x

        areas.forEach((area, ai) => {
          const wa = WORK_AREA_STYLES[area] ?? WORK_AREA_STYLES['Allgemein']
          const subId = `${nodeId}-wa-${ai}-${area}`
          const perpOffset = (ai - (areas.length - 1) / 2) * SUB_PERP
          const cx = pos.x + out_x * SUB_RADIAL + perp_x * perpOffset
          const cy = pos.y + out_y * SUB_RADIAL + perp_y * perpOffset

          nodes.push({
            id: subId,
            type: 'workArea',
            position: { x: cx - SUB_W / 2, y: cy - SUB_H / 2 },
            data: { label: area, ...wa },
          })

          edges.push({
            id: `e-${subId}`,
            source: nodeId,
            sourceHandle: 'out',
            target: subId,
            targetHandle: 'in',
            type: 'smooth',
            style: { stroke: wa.color, strokeWidth: 1.3, opacity: 0.55 },
          })
        })
      }
    })

    // ─── Cross-edges between collaborating agents (base names) ───────────────
    const agentBaseNames = agentList.map(a => a.base)
    const collabs = getCollaborations(agentBaseNames)
    const nodeIdOf = (agent: string) => `agent-${agent.replace(/[^a-z0-9]/gi, '-')}`
    const knownNodes = new Set(agentList.map(a => nodeIdOf(a.base)))

    collabs.forEach((c, i) => {
      const fromId = nodeIdOf(c.from)
      const toId = nodeIdOf(c.to)
      if (!knownNodes.has(fromId) || !knownNodes.has(toId)) return
      edges.push({
        id: `cross-${i}-${fromId}-${toId}`,
        source: fromId,
        sourceHandle: 'out',
        target: toId,
        targetHandle: 'in',
        type: 'smooth',
        style: {
          stroke: c.color,
          strokeWidth: 1.2,
          opacity: 0.45,
          strokeDasharray: '5 4',
        },
      })
    })

    return {
      nodes: [...nodes, ...zipNodes],
      edges: [...edges, ...zipEdges],
    }
  }, [messages, goal, projectName, selectedNodeAgent, zipNodes, zipEdges])

  return (
    <>
      <style>{`
        @keyframes nodeAppear {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
      <div className="relative w-full h-full" style={{ background: '#030912' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#0f172a" gap={32} size={1} />
          <MapControls />
          <Legend />
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
