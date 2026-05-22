'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { ModelData, useNodeGraphStore } from '@/lib/nodeGraphStore'

const PROVIDERS = [
  { id: 'groq', label: 'Groq', model: 'llama-3.1-8b-instant' },
  { id: 'gemini', label: 'Gemini', model: 'gemini-2.0-flash' },
  { id: 'mistral', label: 'Mistral', model: 'mistral-small-latest' },
  { id: 'openrouter', label: 'OpenRouter', model: 'baidu/cobuddy:free' },
] as const

export default function ModelNode({ id, data }: NodeProps) {
  const d = data as ModelData
  const updateNodeData = useNodeGraphStore((s) => s.updateNodeData)
  const provider = PROVIDERS.find((p) => p.id === d.provider) ?? PROVIDERS[0]

  return (
    <div className="relative min-w-[160px] bg-[#13131f] border border-[#2d2d50] hover:border-green-500/40 rounded-2xl shadow-xl shadow-black/40 transition-colors">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-500 leading-none mb-0.5">Chat Model</div>
          <div className="text-[13px] text-slate-200 font-medium truncate">{provider.label} Chat Model</div>
        </div>
        <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] text-green-400 font-bold">{d.itemCount}</span>
        </div>
      </div>

      <div className="h-px bg-[#2d2d50] mx-4" />

      {/* Provider selector */}
      <div className="px-4 py-3">
        <select
          value={d.provider}
          onChange={(e) => {
            const p = PROVIDERS.find((pr) => pr.id === e.target.value)
            if (p) updateNodeData(id, { provider: p.id, model: p.model })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full bg-[#1e1e2e] border border-[#2d2d50] text-slate-300 text-[11px] rounded-lg px-2 py-1.5 outline-none focus:border-green-500/50 transition-colors"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <div className="mt-1.5 text-[10px] text-slate-600 truncate">{d.model}</div>
      </div>

      {/* Status dot */}
      <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-green-500" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-green-500/60 !border-2 !border-[#13131f] !rounded-full"
      />
    </div>
  )
}
