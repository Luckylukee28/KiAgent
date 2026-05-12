'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAgentStore } from '@/lib/store'
import { buildPreview, extractCodeFiles, type CodeFile } from '@/lib/codeExtractor'
import CodeBlock from './CodeBlock'

interface Props {
  open: boolean
  onClose: () => void
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['ts', 'tsx'].includes(ext))       return '📘'
  if (['js', 'jsx', 'mjs'].includes(ext)) return '📙'
  if (['py'].includes(ext))               return '🐍'
  if (['html', 'htm'].includes(ext))      return '🌐'
  if (['css', 'scss', 'sass'].includes(ext)) return '🎨'
  if (['json'].includes(ext))             return '📋'
  if (['md'].includes(ext))               return '📝'
  if (['sql'].includes(ext))              return '🗄️'
  if (['yaml', 'yml', 'toml', 'ini', 'env'].includes(ext)) return '🔧'
  if (['sh', 'bash'].includes(ext))       return '⚡'
  return '📄'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// Strip phase suffix ("Mistral · Frontend" → "Mistral").
// Multi-word agents like "Project Manager" / "Agent A" are kept whole.
function baseAgentName(agent: string): string {
  if (agent.startsWith('Project Manager')) return 'Project Manager'
  if (agent.startsWith('Self Improver'))   return 'Self Improver'
  if (agent.startsWith('Agent A'))         return 'Agent A'
  if (agent.startsWith('Agent B'))         return 'Agent B'
  return agent.split(/\s*[·\-—]\s*/)[0].trim()
}

// Group files by their BASE agent name, so "Mistral · Frontend" and
// "Mistral · Backend" appear under a single "Mistral" group.
function groupByAgent(files: CodeFile[]): Map<string, CodeFile[]> {
  const m = new Map<string, CodeFile[]>()
  for (const f of files) {
    const key = baseAgentName(f.agent)
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(f)
  }
  return m
}

export default function CodeViewer({ open, onClose }: Props) {
  const { messages, language, projectName } = useAgentStore()
  const is_de = language === 'de'
  const [openTabs, setOpenTabs] = useState<string[]>([])      // ordered list of file ids
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<'code' | 'preview'>('code')
  const [filterAgent, setFilterAgent] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'size' | 'type'>('order')
  const [groupBy, setGroupBy] = useState<'agent' | 'type' | 'none'>('agent')

  const allFiles = useMemo(() => extractCodeFiles(messages), [messages])

  const files = useMemo(() => {
    let list = filterAgent
      ? allFiles.filter(f => baseAgentName(f.agent) === filterAgent)
      : allFiles
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q) || f.agent.toLowerCase().includes(q))
    if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'size') list = [...list].sort((a, b) => b.bytes - a.bytes)
    else if (sortBy === 'type') list = [...list].sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name))
    return list
  }, [allFiles, filterAgent, search, sortBy])

  const grouped = useMemo(() => {
    if (groupBy === 'none') {
      const m = new Map<string, CodeFile[]>()
      m.set('', files)
      return m
    }
    if (groupBy === 'type') {
      const m = new Map<string, CodeFile[]>()
      for (const f of files) {
        const key = f.language || 'plaintext'
        if (!m.has(key)) m.set(key, [])
        m.get(key)!.push(f)
      }
      return m
    }
    return groupByAgent(files)
  }, [files, groupBy])
  const tabs = useMemo(
    () => openTabs.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as CodeFile[],
    [openTabs, allFiles]
  )
  const active = tabs.find(f => f.id === activeId) ?? tabs[0] ?? null
  const preview = useMemo(() => buildPreview(allFiles), [allFiles])

  function openFile(id: string) {
    setOpenTabs(prev => (prev.includes(id) ? prev : [...prev, id]))
    setActiveId(id)
    setMode('code')
  }

  function closeTab(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setOpenTabs(prev => {
      const idx = prev.indexOf(id)
      const next = prev.filter(t => t !== id)
      if (activeId === id) {
        // pick neighbour (right preferred, else left)
        const neighbour = next[idx] ?? next[idx - 1] ?? null
        setActiveId(neighbour)
      }
      return next
    })
  }

  function navigate(dir: 1 | -1) {
    if (tabs.length === 0) return
    const idx = tabs.findIndex(t => t.id === activeId)
    const next = (idx + dir + tabs.length) % tabs.length
    setActiveId(tabs[next].id)
  }

  // Auto-open first file when viewer opens and nothing is selected
  useEffect(() => {
    if (open && tabs.length === 0 && allFiles.length > 0) {
      openFile(allFiles[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allFiles.length])

  // Keyboard: ESC closes, Cmd/Ctrl+W closes tab, Cmd/Ctrl+←/→ navigates
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (activeId) closeTab(activeId)
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        navigate(e.key === 'ArrowRight' ? 1 : -1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId, tabs])

  if (!open) return null

  // Distinct BASE agent names — phases of the same agent are merged into one chip
  const agents = [...new Set(allFiles.map(f => baseAgentName(f.agent)))]

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
         style={{ background: 'rgba(3,9,18,0.96)', backdropFilter: 'blur(10px)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800" style={{ background: '#0d1117' }}>
        <span className="text-xl">👁</span>
        <h2 className="font-bold text-white text-sm">
          {is_de ? 'Code Viewer' : 'Code Viewer'}
          {projectName && <span className="text-gray-500 font-normal ml-2">— {projectName}</span>}
        </h2>
        <span className="text-gray-500 text-xs ml-2">
          {allFiles.length} {is_de ? 'Dateien' : 'files'}
        </span>

        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode('code')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'code' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📄 {is_de ? 'Code' : 'Code'}
          </button>
          <button
            onClick={() => setMode('preview')}
            disabled={!preview}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'preview'
                ? 'bg-green-600 text-white'
                : preview
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 cursor-not-allowed'
            }`}
            title={!preview ? (is_de ? 'Keine HTML/CSS/JS-Dateien zum Vorschau' : 'No HTML/CSS/JS files to preview') : ''}
          >
            🚀 {is_de ? 'Vorschau' : 'Preview'}
          </button>
        </div>

        <button onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl leading-none px-2 ml-1">
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* File tree */}
        <div className="w-72 border-r border-gray-800 flex flex-col" style={{ background: '#0d1117' }}>
          {/* ── Sidebar navigation toolbar ──────────────────────────────── */}
          <div className="border-b border-gray-800 sticky top-0 z-10" style={{ background: '#0d1117' }}>
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={is_de ? 'Datei suchen…' : 'Search file…'}
                  className="w-full bg-gray-800/70 border border-gray-700 rounded-md pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm leading-none"
                  >×</button>
                )}
              </div>
            </div>

            {/* Sort & group selectors */}
            <div className="px-3 pb-2 flex gap-1.5">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-0.5">
                  {is_de ? 'Sortieren' : 'Sort'}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full bg-gray-800/70 border border-gray-700 rounded-md px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="order">{is_de ? 'Reihenfolge' : 'Order'}</option>
                  <option value="name">{is_de ? 'Name' : 'Name'}</option>
                  <option value="size">{is_de ? 'Größe' : 'Size'}</option>
                  <option value="type">{is_de ? 'Typ' : 'Type'}</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-0.5">
                  {is_de ? 'Gruppieren' : 'Group'}
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                  className="w-full bg-gray-800/70 border border-gray-700 rounded-md px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="agent">{is_de ? 'Agent' : 'Agent'}</option>
                  <option value="type">{is_de ? 'Typ' : 'Type'}</option>
                  <option value="none">{is_de ? 'Keine' : 'None'}</option>
                </select>
              </div>
            </div>

            {/* Agent filter chips */}
            {agents.length > 1 && (
              <div className="px-3 pb-3">
                <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">
                  {is_de ? 'Filter' : 'Filter'}
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFilterAgent(null)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      !filterAgent ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {is_de ? 'Alle' : 'All'}
                  </button>
                  {agents.map(a => (
                    <button
                      key={a}
                      onClick={() => setFilterAgent(filterAgent === a ? null : a)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors truncate max-w-[120px] ${
                        filterAgent === a ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                      title={a}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider px-3 py-1.5 flex items-center justify-between">
              <span>{is_de ? 'Dateien' : 'Files'}</span>
              <span className="text-gray-700">{files.length}</span>
            </div>

            {files.length === 0 ? (
              <div className="px-3 py-6 text-center text-gray-600 text-xs">
                {search
                  ? (is_de ? `Keine Dateien für "${search}"` : `No files matching "${search}"`)
                  : (is_de ? 'Noch keine Dateien generiert.' : 'No files generated yet.')}
              </div>
            ) : (
              [...grouped.entries()].map(([groupKey, agentFiles]) => (
                <div key={groupKey || 'all'} className="mb-2">
                  {groupKey && (
                    <div className="text-[9px] text-gray-600 px-3 py-1 uppercase tracking-wider truncate" title={groupKey}>
                      {groupKey}
                    </div>
                  )}
                  {agentFiles.map(f => {
                    const isActive = active?.id === f.id
                    const isOpen = openTabs.includes(f.id)
                    const phase = f.agent.split(/\s*[·\-—]\s*/).slice(1).join(' ').trim()
                    return (
                      <button
                        key={f.id}
                        onClick={() => openFile(f.id)}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          isActive ? 'bg-blue-600/20 border-l-2 border-blue-500' : 'hover:bg-gray-800 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="flex-shrink-0">{fileIcon(f.name)}</span>
                          <span className={`truncate font-mono ${isActive ? 'text-blue-300' : isOpen ? 'text-gray-100' : 'text-gray-400'}`}>
                            {f.name}
                          </span>
                          {isOpen && !isActive && <span className="text-[8px] text-gray-600">●</span>}
                        </div>
                        <div className="text-[9px] text-gray-600 pl-5 flex items-center gap-1.5">
                          <span>{formatBytes(f.bytes)} · {f.language}</span>
                          {phase && (
                            <span className="px-1 py-px rounded bg-gray-800 text-gray-400 text-[8px] uppercase tracking-wider">
                              {phase}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content pane */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          {tabs.length > 0 && mode === 'code' && (
            <div className="flex items-center border-b border-gray-800 bg-gray-950"
                 style={{ minHeight: 36 }}>
              {/* prev / next buttons */}
              <button
                onClick={() => navigate(-1)}
                disabled={tabs.length < 2}
                className="px-2 h-9 text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                title={is_de ? 'Vorherige Datei (Cmd+←)' : 'Previous file (Cmd+←)'}
              >‹</button>

              <div className="flex-1 flex overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                {tabs.map(tab => {
                  const isActive = active?.id === tab.id
                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveId(tab.id)}
                      className={`group flex items-center gap-1.5 px-3 h-9 text-xs cursor-pointer border-r border-gray-800 transition-colors flex-shrink-0 ${
                        isActive
                          ? 'bg-gray-900 text-white border-t-2 border-t-blue-500'
                          : 'bg-gray-950 text-gray-400 hover:bg-gray-900 hover:text-gray-200 border-t-2 border-t-transparent'
                      }`}
                      style={{ marginTop: -1 }}
                      title={`${tab.name} — ${tab.agent}`}
                    >
                      <span className="text-[11px]">{fileIcon(tab.name)}</span>
                      <span className="font-mono truncate max-w-[160px]">
                        {tab.name.split('/').pop()}
                      </span>
                      <button
                        onClick={(e) => closeTab(tab.id, e)}
                        className={`ml-1 w-4 h-4 flex items-center justify-center rounded leading-none transition-all ${
                          isActive
                            ? 'text-gray-500 hover:bg-gray-700 hover:text-white opacity-100'
                            : 'text-gray-600 hover:bg-gray-800 hover:text-white opacity-0 group-hover:opacity-100'
                        }`}
                      >×</button>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => navigate(1)}
                disabled={tabs.length < 2}
                className="px-2 h-9 text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                title={is_de ? 'Nächste Datei (Cmd+→)' : 'Next file (Cmd+→)'}
              >›</button>

              {tabs.length > 0 && (
                <button
                  onClick={() => { setOpenTabs([]); setActiveId(null) }}
                  className="px-3 h-9 text-[10px] text-gray-500 hover:text-white hover:bg-gray-800 transition-colors border-l border-gray-800"
                  title={is_de ? 'Alle schließen' : 'Close all'}
                >
                  {is_de ? 'Alle schließen' : 'Close all'}
                </button>
              )}
            </div>
          )}

          {mode === 'preview' && preview ? (
            <>
              <div className="px-4 py-2 text-[10px] text-gray-400 border-b border-gray-800 bg-gray-900 flex items-center gap-2 flex-wrap">
                <span className="text-green-400">●</span>
                <span className="font-semibold text-white">{preview.label}</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-500">
                  {is_de ? 'verwendet' : 'using'}:
                </span>
                {preview.files.slice(0, 5).map(f => (
                  <span key={f} className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 truncate max-w-[180px]" title={f}>
                    {f.split('/').pop()}
                  </span>
                ))}
                {preview.files.length > 5 && (
                  <span className="text-gray-500">+{preview.files.length - 5}</span>
                )}
                <div className="flex-1" />
                <span className="text-gray-600 text-[9px] uppercase tracking-wider">
                  {preview.kind}
                </span>
              </div>
              <iframe
                srcDoc={preview.html}
                sandbox="allow-scripts allow-same-origin"
                className="flex-1 w-full bg-white border-0"
                title="Preview"
              />
            </>
          ) : active ? (
            <div className="flex-1 overflow-auto p-5">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-lg">{fileIcon(active.name)}</span>
                <span className="font-mono text-white text-sm">{active.name}</span>
                <span className="text-gray-600 text-xs">— {active.agent}</span>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(active.content)
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                  title={is_de ? 'Kopieren' : 'Copy'}
                >
                  📋 {is_de ? 'Kopieren' : 'Copy'}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([active.content], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = active.name.split('/').pop() ?? 'file.txt'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                  title={is_de ? 'Herunterladen' : 'Download'}
                >
                  ⬇ {is_de ? 'Speichern' : 'Save'}
                </button>
              </div>
              <CodeBlock code={active.content} language={active.language} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm flex-col gap-2">
              <span className="text-4xl">📂</span>
              <p>{is_de
                ? 'Starte ein Projekt — die generierten Dateien erscheinen hier.'
                : 'Start a project — generated files will appear here.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
