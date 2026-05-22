'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'

interface LLMNodeData extends Record<string, unknown> {
  label: string
  model: string
  itemCount: number
  status: 'idle' | 'running' | 'done' | 'error'
}

const LLM_CONFIGS = {
  groq: {
    label: 'Groq',
    model: 'llama-3.1-8b-instant',
    icon: '⚡',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-400',
  },
  gemini: {
    label: 'Google Gemini',
    model: 'gemini-2.0-flash',
    icon: '🔵',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-400',
  },
  mistral: {
    label: 'Mistral',
    model: 'mistral-small-latest',
    icon: '⚙️',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    textColor: 'text-purple-400',
  },
  openrouter: {
    label: 'OpenRouter',
    model: 'baidu/cobuddy:free',
    icon: '🌐',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    textColor: 'text-cyan-400',
  },
} as const

const STATUS_DOT = {
  idle: 'bg-slate-600',
  running: 'bg-yellow-400 animate-pulse',
  done: 'bg-green-500',
  error: 'bg-red-500',
}

function createLLMNode(provider: keyof typeof LLM_CONFIGS) {
  return function LLMNode({ id, data }: NodeProps) {
    const d = data as LLMNodeData
    const config = LLM_CONFIGS[provider]
    const status = d.status ?? 'idle'

    return (
      <div className="relative min-w-[165px] bg-[#13131f] border border-[#2d2d50] hover:border-green-500/40 rounded-2xl shadow-xl shadow-black/40 transition-colors">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <div className={`w-8 h-8 rounded-lg ${config.bgColor} ${config.borderColor} border flex items-center justify-center flex-shrink-0`}>
            <span className="text-base">{config.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500 leading-none mb-0.5">LLM</div>
            <div className={`text-[13px] font-medium truncate ${config.textColor}`}>{config.label}</div>
          </div>
          {/* Status badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
            {status === 'done' && d.itemCount > 0 && (
              <span className="text-[10px] text-green-400 font-medium">✓</span>
            )}
          </div>
        </div>

        <div className="h-px bg-[#2d2d50] mx-4" />

        {/* Model info */}
        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-600 mb-1">Model</div>
          <div className="text-[10px] text-slate-400 truncate font-mono">{d.model}</div>
          <div className="text-[10px] text-slate-700 mt-2">
            {status === 'idle' && 'Bereit'}
            {status === 'running' && 'Arbeitet...'}
            {status === 'done' && `${d.itemCount} Ergebnis${d.itemCount !== 1 ? 'se' : ''}`}
            {status === 'error' && 'Fehler'}
          </div>
        </div>

        {/* Status dot */}
        <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-green-500" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>

        {/* Handle */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-green-500/60 !border-2 !border-[#13131f] !rounded-full"
        />
      </div>
    )
  }
}

export const GroqNode = createLLMNode('groq')
export const GeminiNode = createLLMNode('gemini')
export const MistralNode = createLLMNode('mistral')
export const OpenRouterNode = createLLMNode('openrouter')
