'use client'

import { useState } from 'react'
import { useAgentStore } from '@/lib/store'
import { connectWS } from '@/lib/websocket'

export default function TaskInput() {
  const [goal, setGoal] = useState('')
  const { isRunning, setRunning, addMessage, clearMessages, language } = useAgentStore()

  async function handleRun() {
    if (!goal.trim() || isRunning) return

    clearMessages()
    setRunning(true)

    connectWS((data) => {
      addMessage({ agent: data.agent, message: data.message })
    })

    try {
      const res = await fetch('http://localhost:8000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, language }),
      })
      const data = await res.json()
      if (data.status === 'done') {
        addMessage({ agent: 'System', message: language === 'de' ? 'Pipeline abgeschlossen.' : 'Pipeline completed.' })
      }
    } catch (e) {
      addMessage({ agent: 'System', message: language === 'de' ? 'Fehler: Backend nicht erreichbar.' : 'Error: Could not reach backend.' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex gap-2 p-4 border-t border-gray-700">
      <input
        className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={language === 'de' ? 'Beschreibe was du bauen möchtest...' : 'Describe what you want to build...'}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleRun()}
        disabled={isRunning}
      />
      <button
        onClick={handleRun}
        disabled={isRunning || !goal.trim()}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
      >
        {isRunning ? (language === 'de' ? 'Läuft...' : 'Running...') : (language === 'de' ? 'Starten' : 'Run')}
      </button>
    </div>
  )
}
