'use client'

import { useEffect, useRef, useState } from 'react'
import { useAgentStore, SavedSession } from '@/lib/store'

type View = 'nodegraph' | 'chat' | 'workspace'

interface Props {
  view: View
  onViewChange: (v: View) => void
  onOpenViewer: () => void
}

export default function NavMenu({ view, onViewChange, onOpenViewer }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { sessions, loadSession, deleteSession, language, setLanguage, newProject } = useAgentStore()
  const is_de = language === 'de'

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleLoad(session: SavedSession) {
    loadSession(session)
    onViewChange('workspace')
    setOpen(false)
  }

  function handleWorkspace() {
    onViewChange('workspace')
    setOpen(false)
  }

  function handleNodeGraph() {
    onViewChange('nodegraph')
    setOpen(false)
  }

  function handleChat() {
    onViewChange('chat')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-950/60 hover:bg-gray-800/80 text-gray-500 hover:text-white transition-colors backdrop-blur-sm"
        title="Menü"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Language */}
          <div className="p-2 border-b border-gray-800">
            <div className="text-xs text-gray-500 px-3 py-1.5 uppercase tracking-wider">
              {is_de ? 'Sprache' : 'Language'}
            </div>
            <div className="flex gap-1 px-2">
              <button
                onClick={() => setLanguage('de')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${language === 'de' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                🇩🇪 Deutsch
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${language === 'en' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2 border-b border-gray-800">
            <button
              onClick={() => { newProject(); handleNodeGraph() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-green-400 hover:bg-gray-800 font-medium"
            >
              <span className="text-base">✨</span>
              <span>{is_de ? 'Neues Projekt' : 'New Project'}</span>
            </button>
            <button
              onClick={handleNodeGraph}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${view === 'nodegraph' ? 'bg-green-600/20 text-green-300' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <span className="text-base">⬡</span>
              <span className="font-medium">{is_de ? 'Workflow Editor' : 'Workflow Editor'}</span>
            </button>
            <button
              onClick={handleWorkspace}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${view === 'workspace' ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <span className="text-base">◇</span>
              <span className="font-medium">{is_de ? 'Workspace' : 'Workspace'}</span>
            </button>
            <button
              onClick={handleChat}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${view === 'chat' ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <span className="text-base">💬</span>
              <span className="font-medium">{is_de ? 'Chat anzeigen' : 'Show Chat'}</span>
            </button>
            <button
              onClick={() => { onOpenViewer(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-purple-300 hover:bg-gray-800"
            >
              <span className="text-base">👁</span>
              <span className="font-medium">{is_de ? 'Code Viewer' : 'Code Viewer'}</span>
            </button>
          </div>

          {/* History */}
          <div className="p-2">
            <div className="text-xs text-gray-500 px-3 py-1.5 uppercase tracking-wider">
              {is_de ? 'Gespeicherte Mind Maps' : 'Saved Mind Maps'}
            </div>
            {sessions.length === 0 ? (
              <div className="text-xs text-gray-600 px-3 py-3 text-center">
                {is_de ? 'Noch keine gespeicherten Maps' : 'No saved maps yet'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-1 group rounded-lg hover:bg-gray-800 px-2 py-1.5 transition-colors">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => handleLoad(s)}
                    >
                      <div className="text-sm text-gray-200 truncate">{s.goal}</div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(s.savedAt).toLocaleDateString(is_de ? 'de-DE' : 'en-US', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-lg leading-none px-1"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
