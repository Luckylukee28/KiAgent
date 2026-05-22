'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { TriggerData, useNodeGraphStore } from '@/lib/nodeGraphStore'

export default function TriggerNode({ id, data }: NodeProps) {
  const d = data as TriggerData
  const updateNodeData = useNodeGraphStore((s) => s.updateNodeData)

  return (
    <div className="group relative min-w-[175px] bg-[#13131f] border border-[#2d2d50] hover:border-green-500/40 rounded-2xl shadow-xl shadow-black/40 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 leading-none mb-0.5">Trigger</div>
          <div className="text-[13px] text-slate-200 font-medium leading-tight">When chat message received</div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#2d2d50] mx-4" />

      {/* Task Input */}
      <div className="px-4 py-3">
        <textarea
          className="w-full bg-[#1e1e2e] border border-[#2d2d50] focus:border-green-500/50 rounded-lg px-3 py-2 text-[12px] text-slate-300 placeholder-slate-600 resize-none outline-none transition-colors"
          rows={3}
          placeholder="Task eingeben..."
          value={d.task}
          onChange={(e) => updateNodeData(id, { task: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Language selector */}
      <div className="flex gap-1.5 px-4 pb-4">
        {(['de', 'en'] as const).map((lang) => (
          <button
            key={lang}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => updateNodeData(id, { language: lang })}
            className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${
              d.language === lang
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-slate-600 hover:text-slate-400 border border-transparent'
            }`}
          >
            {lang === 'de' ? '🇩🇪 DE' : '🇬🇧 EN'}
          </button>
        ))}
      </div>

      {/* Status dot */}
      <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-green-500" />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-[#13131f] !rounded-full"
      />
    </div>
  )
}
