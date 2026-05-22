'use client'

import { useEffect, useRef } from 'react'
import { useNodeGraphStore, TriggerData } from '@/lib/nodeGraphStore'

interface Props {
  onRun: () => void
  isRunning: boolean
}

export default function TriggerPopup({ onRun, isRunning }: Props) {
  const { nodes, updateNodeData, setPopupOpen } = useNodeGraphStore()
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  const d = triggerNode?.data as TriggerData | undefined
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopupOpen(false)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (d?.task?.trim()) { setPopupOpen(false); onRun() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [d?.task, onRun, setPopupOpen])

  if (!triggerNode) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) setPopupOpen(false) }}
    >
      {/* Dim */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Popup card */}
      <div className="relative w-[420px] bg-[#13131f] border border-[#2d2d50] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2d2d50]">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Trigger</div>
            <div className="text-[14px] text-slate-200 font-medium">Aufgabe eingeben</div>
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

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <textarea
            ref={textareaRef}
            rows={4}
            className="w-full bg-[#1e1e2e] border border-[#2d2d50] focus:border-green-500/50 rounded-xl px-4 py-3 text-[13px] text-slate-200 placeholder-slate-600 resize-none outline-none transition-colors"
            placeholder="z.B. Erstelle eine REST API für eine Todo-App mit FastAPI..."
            value={d?.task ?? ''}
            onChange={(e) => triggerNode && updateNodeData(triggerNode.id, { task: e.target.value })}
          />

          {/* Language toggle */}
          <div className="flex gap-2">
            {(['de', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => triggerNode && updateNodeData(triggerNode.id, { language: lang })}
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2d2d50] bg-[#0d0d1a]/40">
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
              disabled={!d?.task?.trim() || isRunning}
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
