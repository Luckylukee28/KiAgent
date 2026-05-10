'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/lib/store'
import CodeBlock from './CodeBlock'

const AGENT_COLORS: Record<string, string> = {
  'Project Manager': 'bg-teal-900 border-teal-500',
  Architect: 'bg-purple-900 border-purple-500',
  Coder: 'bg-blue-900 border-blue-500',
  Reviewer: 'bg-green-900 border-green-500',
  'Agent A': 'bg-orange-900 border-orange-500',
  'Agent B': 'bg-cyan-900 border-cyan-500',
  Judge: 'bg-yellow-900 border-yellow-500',
  Debate: 'bg-gray-800 border-gray-500',
  Collaboration: 'bg-gray-800 border-gray-500',
  'Frontend Agent': 'bg-pink-900 border-pink-500',
  'Backend Agent': 'bg-indigo-900 border-indigo-500',
  'Self Improver': 'bg-rose-900 border-rose-500',
  Synthesizer: 'bg-violet-900 border-violet-400',
  System: 'bg-gray-800 border-gray-600',
}

// Groq agents get blue tones, Gemini agents get Google-blue/green
function getAgentColor(agent: string): string {
  if (agent.startsWith('Groq ·')) return 'bg-blue-950 border-blue-500'
  if (agent.startsWith('Gemini ·')) return 'bg-sky-950 border-sky-400'
  return AGENT_COLORS[agent] ?? 'bg-gray-900 border-gray-600'
}

const AGENT_ICONS: Record<string, string> = {
  'Project Manager': '📋',
  Architect: '🏗️',
  Coder: '💻',
  Reviewer: '🔍',
  'Agent A': '🔵',
  'Agent B': '🟠',
  Judge: '⚖️',
  Debate: '💬',
  Collaboration: '🤝',
  'Frontend Agent': '🎨',
  'Backend Agent': '⚙️',
  'Self Improver': '🧠',
  Synthesizer: '✨',
  System: '🤖',
}

function getAgentIcon(agent: string): string {
  if (agent.startsWith('Groq ·')) return '🦙'
  if (agent.startsWith('Gemini ·')) return '🔷'
  return AGENT_ICONS[agent] ?? '🤖'
}

function detectLanguage(code: string): string {
  if (code.includes('import React') || code.includes('export default') || code.includes('tsx')) return 'typescript'
  if (code.includes('from fastapi') || code.includes('def ') || code.includes('async def')) return 'python'
  if (code.includes('SELECT') || code.includes('CREATE TABLE')) return 'sql'
  if (code.includes('{') && code.includes('"')) return 'json'
  return 'typescript'
}

function parseMessage(message: string) {
  const parts: { type: 'text' | 'code'; content: string; language?: string }[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(message)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: message.slice(lastIndex, match.index) })
    }
    const lang = match[1] || detectLanguage(match[2])
    parts.push({ type: 'code', content: match[2].trim(), language: lang })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < message.length) {
    parts.push({ type: 'text', content: message.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text' as const, content: message }]
}

export default function AgentChat() {
  const { messages } = useAgentStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border p-4 ${getAgentColor(msg.agent)}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getAgentIcon(msg.agent)}</span>
              <span className="font-bold text-white text-sm">{msg.agent}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-gray-200 text-sm">
              {parseMessage(msg.message).map((part, i) =>
                part.type === 'code' ? (
                  <CodeBlock key={i} code={part.content} language={part.language} />
                ) : (
                  <pre key={i} className="whitespace-pre-wrap font-sans leading-relaxed">
                    {part.content}
                  </pre>
                )
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  )
}
