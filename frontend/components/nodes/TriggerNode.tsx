'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { useNodeGraphStore } from '@/lib/nodeGraphStore'

const MODE_CONFIG = {
  develop: { label: 'Entwickeln', icon: '⚡', color: 'text-green-400', dot: 'bg-green-500' },
  edit:    { label: 'Bearbeiten', icon: '✏️', color: 'text-blue-400',  dot: 'bg-blue-500'  },
  debug:   { label: 'Debuggen',   icon: '🐛', color: 'text-orange-400',dot: 'bg-orange-500'},
} as const

export default function TriggerNode() {
  const { setPopupOpen, executionState, nodes } = useNodeGraphStore()
  const triggerData = nodes.find((n) => n.type === 'trigger')?.data as { task?: string; mode?: string } | undefined
  const hasTask = !!triggerData?.task?.trim()
  const isRunning = executionState === 'running'
  const mode = (triggerData?.mode as keyof typeof MODE_CONFIG) ?? 'develop'
  const cfg = MODE_CONFIG[mode]

  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={() => setPopupOpen(true)}
    >
      <div className={`
        flex items-center gap-2.5 px-4 py-3 min-w-[180px]
        bg-[#13131f] rounded-2xl shadow-xl shadow-black/40
        border transition-all duration-200
        ${isRunning
          ? 'border-green-500/60 shadow-green-500/10'
          : hasTask
            ? 'border-[#2d2d50] hover:border-green-500/30'
            : 'border-[#2d2d50] hover:border-green-500/30'
        }
      `}>
        {/* Icon */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base
          ${isRunning ? 'bg-green-500/20 border border-green-500/40' : 'bg-[#1e1e2e] border border-[#2d2d50]'}
        `}>
          {cfg.icon}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] leading-none mb-0.5 ${cfg.color}`}>{cfg.label}</div>
          <div className="text-[12px] text-slate-300 font-medium leading-tight truncate">
            {isRunning && triggerData?.task
              ? triggerData.task.substring(0, 35) + (triggerData.task.length > 35 ? '...' : '')
              : (hasTask ? 'Task bereit' : 'Klicken zum Eingeben')}
          </div>
        </div>

        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isRunning ? 'bg-green-400 animate-pulse' : hasTask ? cfg.dot : 'bg-slate-700'
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
