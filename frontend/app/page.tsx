'use client'

import { useState } from 'react'
import AgentChat from '@/components/AgentChat'
import TaskInput from '@/components/TaskInput'
import MindMap from '@/components/MindMap'
import NavMenu from '@/components/NavMenu'

export default function Home() {
  const [view, setView] = useState<'chat' | 'mindmap'>('mindmap')

  return (
    <main className="relative flex flex-col h-screen bg-gray-950 text-white">
      <div className="absolute top-3 right-3 z-20">
        <NavMenu view={view} onViewChange={setView} />
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'chat' ? <AgentChat /> : <MindMap />}
      </div>

      <TaskInput />
    </main>
  )
}
