'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { AgentData } from '@/lib/nodeGraphStore'

const STATUS_COLOR = {
  idle: 'text-slate-500',
  running: 'text-yellow-400',
  done: 'text-green-400',
  error: 'text-red-400',
}

const STATUS_DOT = {
  idle: 'bg-slate-600',
  running: 'bg-yellow-400 animate-pulse',
  done: 'bg-green-500',
  error: 'bg-red-500',
}

export default function AgentNode({ data }: NodeProps) {
  const d = data as AgentData
  const status = d.status ?? 'idle'

  return (
    <div className="relative min-w-[220px] bg-[#13131f] border border-[#2d2d50] hover:border-green-500/40 rounded-2xl shadow-xl shadow-black/40 transition-colors">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-teal-400" fill="currentColor">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-2.5 13a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-500 leading-none mb-0.5">AI Agent</div>
          <div className="text-[13px] text-slate-200 font-medium truncate">
            {status === 'running' && d.activeAgent ? d.activeAgent : 'AI Agent'}
          </div>
        </div>
        {/* Status badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          {status === 'done' && d.itemCount > 0 && (
            <span className="text-[10px] text-green-400 font-medium">✓</span>
          )}
        </div>
      </div>

      {/* Status text */}
      <div className="px-4 pb-2">
        <span className={`text-[11px] ${STATUS_COLOR[status]}`}>
          {status === 'idle' && 'Bereit'}
          {status === 'running' && 'Agenten arbeiten...'}
          {status === 'done' && `${d.itemCount} Ergebnis${d.itemCount !== 1 ? 'se' : ''}`}
          {status === 'error' && 'Fehler aufgetreten'}
        </span>
      </div>

      {/* Sub-node labels */}
      <div className="h-px bg-[#2d2d50] mx-4" />
      <div className="grid grid-cols-3 px-4 py-2.5 gap-1">
        {[
          { id: 'llm', label: 'LLMs (4x)', count: 'parallel' },
          { id: 'memory', label: 'Memory', count: 'context' },
          { id: 'tool', label: 'Tools', count: 'execute' },
        ].map(({ id, label, count }) => (
          <div key={id} className="flex flex-col items-center">
            <span className="text-[10px] text-slate-500 whitespace-nowrap">{label}</span>
            <span className="text-[9px] text-slate-700">{count}</span>
          </div>
        ))}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-[#13131f] !rounded-full"
      />

      {/* Output handle (right) */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-[#13131f] !rounded-full"
      />

      {/* Bottom handles for sub-nodes */}
      <Handle
        id="llm"
        type="source"
        position={Position.Bottom}
        style={{ left: '25%' }}
        className="!w-2.5 !h-2.5 !bg-green-500/60 !border-2 !border-[#13131f] !rounded-full"
      />
      <Handle
        id="memory"
        type="source"
        position={Position.Bottom}
        style={{ left: '50%' }}
        className="!w-2.5 !h-2.5 !bg-green-500/60 !border-2 !border-[#13131f] !rounded-full"
      />
      <Handle
        id="tool"
        type="source"
        position={Position.Bottom}
        style={{ left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-green-500/60 !border-2 !border-[#13131f] !rounded-full"
      />
    </div>
  )
}
