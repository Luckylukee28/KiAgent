'use client'

import { useState } from 'react'
import AgentChat from '@/components/AgentChat'
import TaskInput from '@/components/TaskInput'
import Workspace from '@/components/Workspace'
import MindMap from '@/components/MindMap'
import NavMenu from '@/components/NavMenu'
import ProjectNameOverlay from '@/components/ProjectNameOverlay'
import CodeViewer from '@/components/CodeViewer'

export type View = 'chat' | 'mindmap' | 'workspace'

export default function Home() {
  const [view, setView] = useState<View>('workspace')
  const [viewerOpen, setViewerOpen] = useState(false)

  return (
    <main className="relative flex flex-col h-screen bg-gray-950 text-white">
      <div className="absolute top-3 right-3 z-20">
        <NavMenu view={view} onViewChange={setView} onOpenViewer={() => setViewerOpen(true)} />
      </div>

      <div className="flex-1 overflow-hidden relative">
        {view === 'chat'     && <AgentChat />}
        {view === 'mindmap'  && <MindMap />}
        {view === 'workspace'&& <Workspace />}
        <ProjectNameOverlay />
      </div>

      <TaskInput />

      <CodeViewer open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </main>
  )
}
