'use client'

import { useEffect, useRef, useState } from 'react'
import { useAgentStore, type SavedSession } from '@/lib/store'
import { parseZip } from '@/lib/zipParser'

export default function ProjectNameOverlay() {
  const { projectName, setProjectName, setZipTree, language, sessions, loadSession, deleteSession } = useAgentStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const is_de = language === 'de'

  // Avoid hydration mismatch: sessions come from localStorage (client-only)
  useEffect(() => { setMounted(true) }, [])

  if (projectName) return null

  const recentSessions = mounted ? sessions.slice(0, 5) : []

  function handleLoad(session: SavedSession) {
    loadSession(session)
    setProjectName(session.goal.slice(0, 60) || 'Projekt')
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteSession(id)
  }

  async function handleSubmit() {
    if (!input.trim()) return
    setProjectName(input.trim())
  }

  async function handleZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const { nodes, edges, rootName } = await parseZip(file)
      setZipTree(nodes, edges)
      setProjectName(rootName)
    } catch {
      setError(is_de ? 'ZIP konnte nicht gelesen werden.' : 'Could not read ZIP file.')
      setLoading(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
         style={{ background: 'rgba(3,9,18,0.88)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl mx-4 my-auto">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-4xl mb-3">🚀</div>
          <h2 className="text-white text-xl font-bold mb-1">
            {is_de ? 'Neues Projekt' : 'New Project'}
          </h2>
          <p className="text-gray-400 text-sm">
            {is_de ? 'Erstelle ein neues KI-Projekt oder öffne ein bestehendes.' : 'Create a new AI project or open an existing one.'}
          </p>
        </div>

        {/* New AI project */}
        <div className="space-y-3 mb-5">
          <label className="text-xs text-gray-500 uppercase tracking-wider px-1">
            {is_de ? 'Projekt starten' : 'Start Project'}
          </label>
          <input
            autoFocus
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 text-sm placeholder-gray-500"
            placeholder={is_de ? 'z.B. Shopping App, KI-Plattform...' : 'e.g. Shopping App, AI Platform...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-green-500/20"
          >
            {is_de ? 'Projekt erstellen' : 'Create Project'}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs">{is_de ? 'oder' : 'or'}</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* ZIP upload */}
        <div className="space-y-3">
          <label className="text-xs text-gray-500 uppercase tracking-wider px-1">
            {is_de ? 'Bestehendes Projekt öffnen' : 'Open Existing Project'}
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleZip}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 py-3 rounded-xl font-medium transition-colors border border-gray-700 border-dashed"
          >
            {loading ? (
              <span className="animate-spin text-lg">⏳</span>
            ) : (
              <>
                <span className="text-lg">📦</span>
                <span>{is_de ? 'ZIP-Datei öffnen' : 'Open ZIP file'}</span>
              </>
            )}
          </button>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <p className="text-gray-600 text-xs text-center">
            {is_de ? 'Die Ordnerstruktur wird als Mind Map dargestellt.' : 'Folder structure will be shown as a mind map.'}
          </p>
        </div>

        {/* Recent chats / sessions */}
        {recentSessions.length > 0 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 text-xs">{is_de ? 'oder fortsetzen' : 'or continue'}</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider px-1">
                {is_de ? 'Letzte Chats' : 'Recent Chats'}
              </label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {recentSessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleLoad(s)}
                    className="group flex items-start gap-2 p-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-blue-500/50 cursor-pointer transition-all"
                  >
                    <span className="text-base mt-0.5">💬</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 truncate font-medium">
                        {s.goal}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>
                          {new Date(s.savedAt).toLocaleDateString(is_de ? 'de-DE' : 'en-US', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        <span>·</span>
                        <span>{s.messages.length} {is_de ? 'Nachrichten' : 'messages'}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-lg leading-none p-1 transition-all"
                      title={is_de ? 'Löschen' : 'Delete'}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
