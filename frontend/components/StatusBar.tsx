'use client'

import { useAgentStore } from '@/lib/store'

export default function StatusBar() {
  const { status, activeAgent, language } = useAgentStore()
  const is_de = language === 'de'

  const config = {
    idle: {
      dot: 'bg-gray-500',
      text: is_de ? 'Wartet auf Befehl' : 'Waiting for command',
      bar: 'bg-gray-800 border-gray-700',
      textColor: 'text-gray-400',
    },
    thinking: {
      dot: 'bg-yellow-400 animate-pulse',
      text: activeAgent
        ? (is_de ? `${activeAgent} überlegt...` : `${activeAgent} thinking...`)
        : (is_de ? 'Überlegt...' : 'Thinking...'),
      bar: 'bg-yellow-950 border-yellow-800',
      textColor: 'text-yellow-300',
    },
    working: {
      dot: 'bg-green-400 animate-pulse',
      text: activeAgent
        ? (is_de ? `${activeAgent} arbeitet...` : `${activeAgent} working...`)
        : (is_de ? 'Arbeitet...' : 'Working...'),
      bar: 'bg-green-950 border-green-800',
      textColor: 'text-green-300',
    },
  }

  const c = config[status]

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-500 ${c.bar} ${c.textColor}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
      <span className="truncate max-w-[220px]">{c.text}</span>
    </div>
  )
}
