'use client'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background, BackgroundVariant,
  Controls, MiniMap,
  NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import TriggerNode from '@/components/nodes/TriggerNode'
import AgentNode from '@/components/nodes/AgentNode'
import { GroqNode, GeminiNode, MistralNode, OpenRouterNode } from '@/components/nodes/LLMNodes'
import MemoryNode from '@/components/nodes/MemoryNode'
import ToolNode from '@/components/nodes/ToolNode'
import TriggerPopup from '@/components/TriggerPopup'

import { useNodeGraphStore, WorkflowNodeType, TriggerData, AgentData } from '@/lib/nodeGraphStore'
import { connectWS, disconnectWS } from '@/lib/websocket'

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  groq: GroqNode,
  gemini: GeminiNode,
  mistral: MistralNode,
  openrouter: OpenRouterNode,
  memory: MemoryNode,
  tool: ToolNode,
}

const ADD_NODES: { type: WorkflowNodeType; label: string; color: string }[] = [
  { type: 'trigger', label: 'Trigger', color: 'text-green-400 border-green-500/30 hover:border-green-500/60' },
  { type: 'agent', label: 'AI Agent', color: 'text-teal-400 border-teal-500/30 hover:border-teal-500/60' },
  { type: 'groq', label: 'Groq', color: 'text-amber-400 border-amber-500/30 hover:border-amber-500/60' },
  { type: 'gemini', label: 'Gemini', color: 'text-blue-400 border-blue-500/30 hover:border-blue-500/60' },
  { type: 'mistral', label: 'Mistral', color: 'text-purple-400 border-purple-500/30 hover:border-purple-500/60' },
  { type: 'openrouter', label: 'OpenRouter', color: 'text-cyan-400 border-cyan-500/30 hover:border-cyan-500/60' },
  { type: 'memory', label: 'Memory', color: 'text-blue-400 border-blue-500/30 hover:border-blue-500/60' },
  { type: 'tool', label: 'Tool', color: 'text-orange-400 border-orange-500/30 hover:border-orange-500/60' },
]

export default function NodeGraph() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, updateNodeData,
    executionState, setExecutionState,
    setEdgesAnimated,
    addMessage, clearExecution,
    resetGraph,
    popupOpen, setPopupOpen,
  } = useNodeGraphStore()

  const abortRef = useRef<AbortController | null>(null)

  const handleRun = useCallback(async () => {
    const triggerNode = nodes.find((n) => n.type === 'trigger')
    const task = (triggerNode?.data as TriggerData)?.task?.trim()
    const language = (triggerNode?.data as TriggerData)?.language ?? 'de'

    if (!task || executionState === 'running') return

    const agentNode = nodes.find((n) => n.type === 'agent')
    if (!agentNode) return

    clearExecution()
    setExecutionState('running')
    setEdgesAnimated(true)
    updateNodeData(agentNode.id, { status: 'running', activeAgent: 'Pipeline startet...', itemCount: 0 })
    // Animate all LLM nodes as running
    nodes.filter(n => ['groq','gemini','mistral','openrouter'].includes(n.type!))
      .forEach(n => updateNodeData(n.id, { status: 'running' }))

    abortRef.current = new AbortController()
    let messageCount = 0

    connectWS((data) => {
      messageCount++
      addMessage(data)
      updateNodeData(agentNode.id, {
        activeAgent: data.agent,
        itemCount: messageCount,
      })
    })

    try {
      const res = await fetch('http://localhost:8000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: task, language }),
        signal: abortRef.current.signal,
      })
      const result = await res.json()
      if (result.status === 'done') {
        const count = Object.keys(result.results ?? {}).length
        updateNodeData(agentNode.id, { status: 'done', activeAgent: 'AI Agent', itemCount: count })
        nodes.filter(n => ['groq','gemini','mistral','openrouter'].includes(n.type!))
          .forEach(n => updateNodeData(n.id, { status: 'done', itemCount: 1 }))
        setEdgesAnimated(false)
        setExecutionState('done')
      }
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        updateNodeData(agentNode.id, { status: 'error', activeAgent: 'AI Agent' })
        nodes.filter(n => ['groq','gemini','mistral','openrouter'].includes(n.type!))
          .forEach(n => updateNodeData(n.id, { status: 'idle' }))
        setEdgesAnimated(false)
        setExecutionState('idle')
      }
    } finally {
      disconnectWS()
    }
  }, [nodes, executionState, clearExecution, setExecutionState, updateNodeData, addMessage])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    disconnectWS()
    const agentNode = nodes.find((n) => n.type === 'agent')
    if (agentNode) updateNodeData(agentNode.id, { status: 'idle', activeAgent: 'AI Agent' })
    nodes.filter(n => ['groq','gemini','mistral','openrouter'].includes(n.type!))
      .forEach(n => updateNodeData(n.id, { status: 'idle' }))
    setEdgesAnimated(false)
    setExecutionState('idle')
  }, [nodes, updateNodeData, setExecutionState, setEdgesAnimated])

  const isRunning = executionState === 'running'

  return (
    <div className="w-full h-full flex flex-col bg-[#0d0d1a]">
      {popupOpen && <TriggerPopup onRun={handleRun} isRunning={isRunning} />}
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0d0d1a] border-b border-[#1e1e30] z-10">
        {/* Add node buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-600 mr-1">+ Node:</span>
          {ADD_NODES.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors bg-[#13131f] ${color}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Reset */}
        <button
          onClick={resetGraph}
          disabled={isRunning}
          className="px-3 py-1.5 rounded-lg border border-[#2d2d50] text-slate-500 hover:text-slate-300 hover:border-slate-500 text-[11px] transition-colors disabled:opacity-40"
        >
          Reset
        </button>

        {/* Run / Stop */}
        {isRunning ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 text-[12px] font-medium transition-colors"
          >
            <span className="w-2 h-2 bg-red-400 rounded-sm" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50 text-[12px] font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run Pipeline
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={2}
          deleteKeyCode="Delete"
          className="bg-[#0d0d1a]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#1e1e30"
          />
          <Controls
            className="!bg-[#13131f] !border-[#2d2d50] !rounded-xl !shadow-xl"
            showInteractive={false}
          />
          <MiniMap
            className="!bg-[#13131f] !border-[#2d2d50] !rounded-xl"
            nodeColor="#1e1e2e"
            maskColor="rgba(13, 13, 26, 0.8)"
          />
        </ReactFlow>

        {/* Live message ticker */}
        {isRunning && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#13131f]/90 backdrop-blur-sm border border-green-500/20 rounded-full px-4 py-2 flex items-center gap-2 text-[12px] text-slate-400 z-10 shadow-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {useNodeGraphStore.getState().messages.at(-1)?.agent ?? 'Pipeline läuft...'}
          </div>
        )}
      </div>
    </div>
  )
}
