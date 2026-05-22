'use client'

import { useEffect, useRef } from 'react'
import { useNodeGraphStore, TriggerData } from '@/lib/nodeGraphStore'

interface Props {
  onRun: () => void
  isRunning: boolean
}

const MODES = [
  { id: 'develop', label: 'Entwickeln', icon: '⚡', desc: 'Neues Projekt / Feature erstellen' },
  { id: 'edit',    label: 'Bearbeiten', icon: '✏️', desc: 'Bestehenden Code ändern' },
  { id: 'debug',   label: 'Debuggen',   icon: '🐛', desc: 'Fehler finden & beheben' },
] as const

export default function TriggerPopup({ onRun, isRunning }: Props) {
  const { nodes, updateNodeData, setPopupOpen } = useNodeGraphStore()
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  const d = triggerNode?.data as TriggerData | undefined
  const taskRef = useRef<HTMLTextAreaElement>(null)

  const mode = d?.mode ?? 'develop'
  const showCode = mode === 'edit' || mode === 'debug'
  const showError = mode === 'debug'

  useEffect(() => { taskRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopupOpen(false)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const valid = d?.task?.trim() && (showCode ? d?.existingCode?.trim() : true)
        if (valid) { setPopupOpen(false); onRun() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [d, onRun, setPopupOpen, showCode])

  if (!triggerNode) return null

  function update(patch: Partial<TriggerData>) {
    updateNodeData(triggerNode!.id, patch)
  }

  const canRun = !!d?.task?.trim() && (showCode ? !!d?.existingCode?.trim() : true) && !isRunning

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) setPopupOpen(false) }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[520px] max-h-[90vh] flex flex-col bg-[#13131f] border border-[#2d2d50] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2d2d50]">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-base">
            {MODES.find(m => m.id === mode)?.icon}
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Coding Agent</div>
            <div className="text-[14px] text-slate-200 font-medium">
              {MODES.find(m => m.id === mode)?.desc}
            </div>
          </div>
          <button
            onClick={() => setPopupOpen(false)}
            className="ml-auto w-7 h-7 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-[#2d2d50] flex items-center justify-center transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1.5 px-5 pt-4 pb-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => update({ mode: m.id })}
              className={`flex items-center gap-1.5 flex-1 py-2 px-3 rounded-xl text-[12px] font-medium border transition-colors ${
                mode === m.id
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'text-slate-500 border-[#2d2d50] hover:text-slate-300 hover:border-slate-500 bg-transparent'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3 mt-2">

          {/* Task description */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5">
              {mode === 'develop' ? 'Was soll entwickelt werden?' :
               mode === 'edit'    ? 'Was soll geändert werden?' :
                                    'Was ist das Problem / Was soll gefixt werden?'}
            </label>
            <textarea
              ref={taskRef}
              rows={3}
              className="w-full bg-[#1e1e2e] border border-[#2d2d50] focus:border-green-500/50 rounded-xl px-4 py-3 text-[13px] text-slate-200 placeholder-slate-600 resize-none outline-none transition-colors"
              placeholder={
                mode === 'develop' ? 'z.B. Erstelle eine REST API für eine Todo-App mit FastAPI...' :
                mode === 'edit'    ? 'z.B. Füge Input-Validierung hinzu und refaktoriere die Fehlerbehandlung...' :
                                     'z.B. TypeError: cannot unpack non-iterable NoneType object (optional — Fehlermeldung unten reicht auch)'
              }
              value={d?.task ?? ''}
              onChange={(e) => update({ task: e.target.value })}
            />
          </div>

          {/* Existing code (edit + debug) */}
          {showCode && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">
                {mode === 'edit' ? 'Bestehender Code (einfügen)' : 'Code mit dem Fehler (einfügen)'}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <textarea
                rows={10}
                className="w-full bg-[#1a1a2e] border border-[#2d2d50] focus:border-green-500/50 rounded-xl px-4 py-3 text-[12px] text-slate-300 placeholder-slate-700 resize-y outline-none transition-colors font-mono"
                placeholder="# Code hier einfügen..."
                value={d?.existingCode ?? ''}
                onChange={(e) => update({ existingCode: e.target.value })}
              />
            </div>
          )}

          {/* Error message (debug only) */}
          {showError && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">
                Fehlermeldung / Stack Trace
              </label>
              <textarea
                rows={4}
                className="w-full bg-[#1a1a2e] border border-[#2d2d50] focus:border-orange-500/40 rounded-xl px-4 py-3 text-[12px] text-orange-300/80 placeholder-slate-700 resize-y outline-none transition-colors font-mono"
                placeholder="Traceback (most recent call last):&#10;  ..."
                value={d?.errorMessage ?? ''}
                onChange={(e) => update({ errorMessage: e.target.value })}
              />
            </div>
          )}

          {/* Language toggle */}
          <div className="flex gap-2 pt-1">
            {(['de', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => update({ language: lang })}
                className={`flex-1 py-2 rounded-xl text-[12px] font-medium transition-colors border ${
                  d?.language === lang
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'text-slate-600 border-[#2d2d50] hover:text-slate-400 hover:border-slate-600'
                }`}
              >
                {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2d2d50] bg-[#0d0d1a]/40 flex-shrink-0">
          <span className="text-[11px] text-slate-700">⌘ Enter zum Starten</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPopupOpen(false)}
              className="px-4 py-2 rounded-xl text-[12px] text-slate-500 hover:text-slate-300 hover:bg-[#2d2d50] transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={() => { setPopupOpen(false); onRun() }}
              disabled={!canRun}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-medium bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 5v14l11-7z" />
              </svg>
              Pipeline starten
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
