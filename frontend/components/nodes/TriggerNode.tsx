'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { useNodeGraphStore } from '@/lib/nodeGraphStore'

export default function TriggerNode() {
  const { setPopupOpen, executionState, nodes } = useNodeGraphStore()
  const triggerData = nodes.find((n) => n.type === 'trigger')?.data as { task?: string } | undefined
  const hasTask = !!triggerData?.task?.trim()
  const isRunning = executionState === 'running'

  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={() => setPopupOpen(true)}
    >
      <div className={`
        flex items-center gap-2.5 px-4 py-3 min-w-[160px]
        bg-[#13131f] rounded-2xl shadow-xl shadow-black/40
        border transition-all duration-200
        ${isRunning
          ? 'border-green-500/60 shadow-green-500/10'
          : hasTask
            ? 'border-green-500/30 hover:border-green-500/50'
            : 'border-[#2d2d50] hover:border-green-500/30'
        }
      `}>
        {/* Icon */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
          ${isRunning ? 'bg-green-500/20 border border-green-500/40' : 'bg-green-500/10 border border-green-500/20'}
        `}>
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${isRunning ? 'text-green-300' : 'text-green-400'}`} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-slate-600 leading-none mb-0.5">Trigger</div>
          <div className="text-[12px] text-slate-300 font-medium leading-tight truncate">
            {hasTask ? 'Task bereit' : 'Klicken zum Eingeben'}
          </div>
        </div>

        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isRunning ? 'bg-green-400 animate-pulse' : hasTask ? 'bg-green-500' : 'bg-slate-700'
        }`} />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-[#13131f] !rounded-full"
      />
    </div>
  )
}
