'use client'

import { useRef, useState } from 'react'
import { useAgentStore } from '@/lib/store'
import { parseZip } from '@/lib/zipParser'

export default function ProjectNameOverlay() {
  const { projectName, setProjectName, setZipTree, language } = useAgentStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const is_de = language === 'de'

  if (projectName) return null

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
    <div className="absolute inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(3,9,18,0.88)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl mx-4">

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
      </div>
    </div>
  )
}
