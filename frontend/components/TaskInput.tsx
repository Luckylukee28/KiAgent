'use client'

import { useRef, useState } from 'react'
import { useAgentStore } from '@/lib/store'
import { connectWS, disconnectWS } from '@/lib/websocket'

export default function TaskInput() {
  const [input, setInput] = useState('')
  const { isRunning, setRunning, addMessage, clearMessages, language, setGoal: storeSetGoal, saveCurrentSession, messages, goal, selectedNodeAgent, setSelectedNodeAgent } = useAgentStore()
  const abortRef = useRef<AbortController | null>(null)

  const isFollowUp = !isRunning && messages.length > 0 && !!goal
  const is_de = language === 'de'

  async function handleRun() {
    if (!input.trim() || isRunning) return

    abortRef.current = new AbortController()

    if (isFollowUp) {
      // Follow-up mode: send to /api/chat
      setRunning(true)
      connectWS((data) => addMessage({ agent: data.agent, message: data.message }))
      const followUp = input
      setInput('')
      addMessage({ agent: 'System', message: `❓ ${followUp}` })
      try {
        // If a node is selected, use only that node's content as context
        const context = selectedNodeAgent
          ? messages.find((m) => m.agent === selectedNodeAgent)?.message ?? ''
          : messages
              .filter((m) => !m.message.endsWith('...') && m.message.length > 80)
              .slice(-5)
              .map((m) => `${m.agent}: ${m.message.slice(0, 300)}`)
              .join('\n\n')
        await fetch('http://localhost:8000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: followUp, context, language }),
          signal: abortRef.current.signal,
        })
      } catch (e: any) {
        if (e?.name !== 'AbortError') addMessage({ agent: 'System', message: is_de ? 'Fehler: Backend nicht erreichbar.' : 'Error: Could not reach backend.' })
      } finally {
        setRunning(false)
        disconnectWS()
      }
    } else {
      // New pipeline
      clearMessages()
      storeSetGoal(input)
      setRunning(true)
      connectWS((data) => addMessage({ agent: data.agent, message: data.message }))
      const goal = input
      setInput('')
      try {
        const res = await fetch('http://localhost:8000/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, language }),
          signal: abortRef.current.signal,
        })
        const data = await res.json()
        if (data.status === 'done') addMessage({ agent: 'System', message: is_de ? '✅ Pipeline abgeschlossen.' : '✅ Pipeline completed.' })
      } catch (e: any) {
        if (e?.name !== 'AbortError') addMessage({ agent: 'System', message: is_de ? 'Fehler: Backend nicht erreichbar.' : 'Error: Could not reach backend.' })
      } finally {
        saveCurrentSession()
        setRunning(false)
        disconnectWS()
      }
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    disconnectWS()
    setRunning(false)
    addMessage({ agent: 'System', message: is_de ? '⏹ Gestoppt.' : '⏹ Stopped.' })
  }

  const placeholder = isRunning
    ? (is_de ? 'Ich führe deinen Befehl aus.' : 'Executing your command.')
    : (is_de ? 'Wie kann ich dir heute weiterhelfen?' : 'How can I help you today?')

  return (
    <div className="border-t border-gray-800">
      {selectedNodeAgent && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <span className="text-xs text-gray-400">{is_de ? 'Kontext:' : 'Context:'}</span>
          <span className="flex items-center gap-1.5 bg-blue-950 border border-blue-500 text-blue-300 text-xs px-2 py-0.5 rounded-full">
            📌 {selectedNodeAgent}
          </span>
          <button
            onClick={() => setSelectedNodeAgent(null)}
            className="text-gray-600 hover:text-gray-400 text-sm ml-1 transition-colors"
            title={is_de ? 'Kontext entfernen' : 'Clear context'}
          >×</button>
        </div>
      )}
    <div className="flex items-center gap-3 px-4 py-3">
      {isFollowUp && !isRunning && (
        <div className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">
          💬 {goal.length > 30 ? goal.slice(0, 30) + '…' : goal}
        </div>
      )}
      <input
        className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 text-sm"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleRun()}
        disabled={isRunning}
      />
      {isRunning ? (
        <button
          onClick={handleStop}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-lg"
          title="Stop"
        >
          <span className="w-4 h-4 bg-white rounded-sm block" />
        </button>
      ) : (
        <button
          onClick={handleRun}
          disabled={!input.trim()}
          className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-lg shadow-green-500/30"
          title={is_de ? 'Senden' : 'Send'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M9 6v12l9-6z" />
          </svg>
        </button>
      )}
    </div>
    </div>
  )
}
