'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { ToolData, useNodeGraphStore } from '@/lib/nodeGraphStore'

export default function ToolNode({ id, data }: NodeProps) {
  const d = data as ToolData
  const updateNodeData = useNodeGraphStore((s) => s.updateNodeData)

  return (
    <div className="relative min-w-[155px] bg-[#13131f] border border-[#2d2d50] hover:border-green-500/40 rounded-2xl shadow-xl shadow-black/40 transition-colors">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-500 leading-none mb-0.5">Tool</div>
          <div className="text-[13px] text-slate-200 font-medium truncate">{d.name}</div>
        </div>
        <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] text-green-400 font-bold">{d.itemCount}</span>
        </div>
      </div>

      <div className="h-px bg-[#2d2d50] mx-4" />

      {/* Tool name input */}
      <div className="px-4 py-3">
        <input
          type="text"
          value={d.name}
          onChange={(e) => updateNodeData(id, { name: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full bg-[#1e1e2e] border border-[#2d2d50] text-slate-300 text-[11px] rounded-lg px-2 py-1.5 outline-none focus:border-green-500/50 transition-colors"
          placeholder="tool-name"
        />
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
