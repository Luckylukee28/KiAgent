import { create } from 'zustand'
import {
  Node, Edge, addEdge,
  applyNodeChanges, applyEdgeChanges,
  NodeChange, EdgeChange, Connection,
} from '@xyflow/react'

export type WorkflowNodeType = 'trigger' | 'agent' | 'groq' | 'gemini' | 'mistral' | 'openrouter' | 'memory' | 'tool'

export interface TriggerData extends Record<string, unknown> {
  task: string
  language: 'de' | 'en'
  mode: 'develop' | 'edit' | 'debug'
  existingCode: string
  errorMessage: string
}

export interface AgentData extends Record<string, unknown> {
  label: string
  status: 'idle' | 'running' | 'done' | 'error'
  activeAgent: string
  itemCount: number
}

export interface LLMNodeData extends Record<string, unknown> {
  label: string
  model: string
  itemCount: number
  status: 'idle' | 'running' | 'done' | 'error'
}

export interface MemoryData extends Record<string, unknown> {
  strategy: 'sqlite' | 'redis'
  itemCount: number
}

export interface ToolData extends Record<string, unknown> {
  name: string
  itemCount: number
}

const EDGE_MAIN  = { stroke: '#22c55e',   strokeWidth: 1.5 }
const EDGE_LLM   = { stroke: '#22c55e44', strokeWidth: 1.5 }
const EDGE_SUPP  = { stroke: '#3b82f644', strokeWidth: 1.5 }

// Only Trigger, Agent and 4 LLMs visible at startup
export const DEFAULT_NODES: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 80, y: 270 },
    data: { task: '', language: 'de', mode: 'develop', existingCode: '', errorMessage: '' } as TriggerData,
  },
  {
    id: 'agent-1',
    type: 'agent',
    position: { x: 380, y: 240 },
    data: { label: 'AI Agent', status: 'idle', activeAgent: '', itemCount: 0 } as AgentData,
  },
  {
    id: 'groq-1',
    type: 'groq',
    position: { x: 60,  y: 520 },
    data: { label: 'Groq', model: 'llama-3.1-8b-instant', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'gemini-1',
    type: 'gemini',
    position: { x: 270, y: 520 },
    data: { label: 'Google Gemini', model: 'gemini-2.0-flash', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'mistral-1',
    type: 'mistral',
    position: { x: 480, y: 520 },
    data: { label: 'Mistral', model: 'mistral-small-latest', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'openrouter-1',
    type: 'openrouter',
    position: { x: 690, y: 520 },
    data: { label: 'OpenRouter', model: 'baidu/cobuddy:free', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
]

// Edges go LLM → Agent (response direction, upward)
export const DEFAULT_EDGES: Edge[] = [
  {
    id: 'e-trigger-agent',
    source: 'trigger-1', target: 'agent-1',
    animated: false,
    style: EDGE_MAIN,
  },
  {
    id: 'e-groq-agent',
    source: 'groq-1', target: 'agent-1', targetHandle: 'from-groq',
    type: 'straight', animated: false,
    style: EDGE_LLM,
  },
  {
    id: 'e-gemini-agent',
    source: 'gemini-1', target: 'agent-1', targetHandle: 'from-gemini',
    type: 'straight', animated: false,
    style: EDGE_LLM,
  },
  {
    id: 'e-mistral-agent',
    source: 'mistral-1', target: 'agent-1', targetHandle: 'from-mistral',
    type: 'straight', animated: false,
    style: EDGE_LLM,
  },
  {
    id: 'e-openrouter-agent',
    source: 'openrouter-1', target: 'agent-1', targetHandle: 'from-openrouter',
    type: 'straight', animated: false,
    style: EDGE_LLM,
  },
]

// Support nodes (appear when pipeline starts)
const SUPPORT_NODES: Node[] = [
  {
    id: 'memory-1',
    type: 'memory',
    position: { x: 380, y: 420 },
    data: { strategy: 'sqlite', itemCount: 0 } as MemoryData,
  },
  {
    id: 'tool-1',
    type: 'tool',
    position: { x: 620, y: 420 },
    data: { name: 'fetch-from-backend', itemCount: 0 } as ToolData,
  },
]

const SUPPORT_EDGES: Edge[] = [
  {
    id: 'e-agent-memory',
    source: 'agent-1', target: 'memory-1',
    type: 'smoothstep', animated: false,
    style: EDGE_SUPP,
  },
  {
    id: 'e-agent-tool',
    source: 'agent-1', target: 'tool-1',
    type: 'smoothstep', animated: false,
    style: EDGE_SUPP,
  },
]

interface NodeGraphStore {
  nodes: Node[]
  edges: Edge[]
  executionState: 'idle' | 'running' | 'done'
  messages: { agent: string; message: string }[]
  popupOpen: boolean

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void
  addNode: (type: WorkflowNodeType) => void
  removeNode: (id: string) => void
  setExecutionState: (state: 'idle' | 'running' | 'done') => void
  setEdgeAnimated: (edgeId: string, animated: boolean) => void
  setEdgesAnimated: (animated: boolean) => void
  showSupportNodes: () => void
  addMessage: (msg: { agent: string; message: string }) => void
  clearExecution: () => void
  resetGraph: () => void
  setPopupOpen: (open: boolean) => void
}

export const useNodeGraphStore = create<NodeGraphStore>((set) => ({
  nodes: DEFAULT_NODES,
  edges: DEFAULT_EDGES,
  executionState: 'idle',
  messages: [],
  popupOpen: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({
      edges: addEdge({ ...connection, animated: false, style: EDGE_MAIN }, s.edges),
    })),

  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  addNode: (type) => {
    const id = `${type}-${Date.now()}`
    const defaults: Record<WorkflowNodeType, Record<string, unknown>> = {
      trigger:     { task: '', language: 'de', mode: 'develop', existingCode: '', errorMessage: '' },
      agent:       { label: 'AI Agent', status: 'idle', activeAgent: '', itemCount: 0 },
      groq:        { label: 'Groq', model: 'llama-3.1-8b-instant', itemCount: 0, status: 'idle' },
      gemini:      { label: 'Google Gemini', model: 'gemini-2.0-flash', itemCount: 0, status: 'idle' },
      mistral:     { label: 'Mistral', model: 'mistral-small-latest', itemCount: 0, status: 'idle' },
      openrouter:  { label: 'OpenRouter', model: 'baidu/cobuddy:free', itemCount: 0, status: 'idle' },
      memory:      { strategy: 'sqlite', itemCount: 0 },
      tool:        { name: 'new-tool', itemCount: 0 },
    }
    set((s) => ({
      nodes: [
        ...s.nodes,
        { id, type, position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 }, data: defaults[type] },
      ],
    }))
  },

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  setExecutionState: (executionState) => set({ executionState }),

  setEdgeAnimated: (edgeId, animated) =>
    set((s) => ({
      edges: s.edges.map((e) => e.id === edgeId ? { ...e, animated } : e),
    })),

  setEdgesAnimated: (animated) =>
    set((s) => ({ edges: s.edges.map((e) => ({ ...e, animated })) })),

  showSupportNodes: () =>
    set((s) => {
      const existingIds = new Set(s.nodes.map((n) => n.id))
      const newNodes = SUPPORT_NODES.filter((n) => !existingIds.has(n.id))
      const existingEdgeIds = new Set(s.edges.map((e) => e.id))
      const newEdges = SUPPORT_EDGES.filter((e) => !existingEdgeIds.has(e.id))
      return { nodes: [...s.nodes, ...newNodes], edges: [...s.edges, ...newEdges] }
    }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  clearExecution: () =>
    set((s) => ({
      messages: [],
      executionState: 'idle',
      // Remove support nodes, keep only defaults
      nodes: s.nodes
        .filter((n) => !['memory-1', 'tool-1'].includes(n.id))
        .map((n) =>
          n.type === 'agent'
            ? { ...n, data: { ...n.data, status: 'idle', activeAgent: '', itemCount: 0 } }
            : ['groq', 'gemini', 'mistral', 'openrouter'].includes(n.type ?? '')
              ? { ...n, data: { ...n.data, status: 'idle', itemCount: 0 } }
              : n
        ),
      edges: s.edges.filter((e) => !['e-agent-memory', 'e-agent-tool'].includes(e.id))
        .map((e) => ({ ...e, animated: false })),
    })),

  resetGraph: () =>
    set({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES, executionState: 'idle', messages: [], popupOpen: false }),

  setPopupOpen: (popupOpen) => set({ popupOpen }),
}))
