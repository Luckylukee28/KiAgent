'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import NavMenu from '@/components/NavMenu'
import ProjectNameOverlay from '@/components/ProjectNameOverlay'
import CodeViewer from '@/components/CodeViewer'
import AgentChat from '@/components/AgentChat'
import Workspace from '@/components/Workspace'

const NodeGraph = dynamic(() => import('@/components/NodeGraph'), { ssr: false })

export type View = 'nodegraph' | 'chat' | 'workspace'

export default function Home() {
  const [view, setView] = useState<View>('nodegraph')
  const [viewerOpen, setViewerOpen] = useState(false)

  return (
    <main className="relative flex flex-col h-screen bg-[#0d0d1a] text-white">
      <div className="absolute top-3 right-3 z-20">
        <NavMenu view={view} onViewChange={setView} onOpenViewer={() => setViewerOpen(true)} />
      </div>

      <div className="flex-1 overflow-hidden relative">
        {view === 'nodegraph' && <NodeGraph />}
        {view === 'chat' && <AgentChat />}
        {view === 'workspace' && <Workspace />}
        <ProjectNameOverlay />
      </div>

      <CodeViewer open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </main>
  )
}
