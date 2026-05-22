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

const EDGE_STYLE = { stroke: '#22c55e', strokeWidth: 1.5 }
const EDGE_STYLE_DIM = { stroke: '#22c55e55', strokeWidth: 1.5 }
const LABEL_STYLE = { fill: '#64748b', fontSize: 11, fontFamily: 'inherit' }
const LABEL_BG = { fill: 'transparent' }

export const DEFAULT_NODES: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 60, y: 210 },
    data: { task: '', language: 'de' } as TriggerData,
  },
  {
    id: 'agent-1',
    type: 'agent',
    position: { x: 380, y: 190 },
    data: { label: 'AI Agent', status: 'idle', activeAgent: '', itemCount: 0 } as AgentData,
  },
  {
    id: 'groq-1',
    type: 'groq',
    position: { x: 100, y: 430 },
    data: { label: 'Groq', model: 'llama-3.1-8b-instant', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'gemini-1',
    type: 'gemini',
    position: { x: 310, y: 430 },
    data: { label: 'Google Gemini', model: 'gemini-2.0-flash', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'mistral-1',
    type: 'mistral',
    position: { x: 520, y: 430 },
    data: { label: 'Mistral', model: 'mistral-small-latest', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'openrouter-1',
    type: 'openrouter',
    position: { x: 730, y: 430 },
    data: { label: 'OpenRouter', model: 'baidu/cobuddy:free', itemCount: 0, status: 'idle' } as LLMNodeData,
  },
  {
    id: 'memory-1',
    type: 'memory',
    position: { x: 380, y: 600 },
    data: { strategy: 'sqlite', itemCount: 0 } as MemoryData,
  },
  {
    id: 'tool-1',
    type: 'tool',
    position: { x: 620, y: 600 },
    data: { name: 'fetch-from-backend', itemCount: 0 } as ToolData,
  },
]

const DEFAULT_EDGES: Edge[] = [
  {
    id: 'e-trigger-agent',
    source: 'trigger-1', target: 'agent-1',
    label: '1 task', animated: true,
    style: EDGE_STYLE, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-groq',
    source: 'agent-1', sourceHandle: 'llm', target: 'groq-1',
    type: 'smoothstep', label: 'debate',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-gemini',
    source: 'agent-1', sourceHandle: 'llm', target: 'gemini-1',
    type: 'smoothstep', label: 'debate',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-mistral',
    source: 'agent-1', sourceHandle: 'llm', target: 'mistral-1',
    type: 'smoothstep', label: 'debate',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-openrouter',
    source: 'agent-1', sourceHandle: 'llm', target: 'openrouter-1',
    type: 'smoothstep', label: 'debate',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-memory',
    source: 'agent-1', sourceHandle: 'memory', target: 'memory-1',
    type: 'smoothstep', label: 'context',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-tool',
    source: 'agent-1', sourceHandle: 'tool', target: 'tool-1',
    type: 'smoothstep', label: 'execute',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
]

interface NodeGraphStore {
  nodes: Node[]
  edges: Edge[]
  executionState: 'idle' | 'running' | 'done'
  messages: { agent: string; message: string }[]

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void
  addNode: (type: WorkflowNodeType) => void
  removeNode: (id: string) => void
  setExecutionState: (state: 'idle' | 'running' | 'done') => void
  addMessage: (msg: { agent: string; message: string }) => void
  clearExecution: () => void
  resetGraph: () => void
}

export const useNodeGraphStore = create<NodeGraphStore>((set) => ({
  nodes: DEFAULT_NODES,
  edges: DEFAULT_EDGES,
  executionState: 'idle',
  messages: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({
      edges: addEdge({ ...connection, animated: true, style: EDGE_STYLE }, s.edges),
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
      trigger: { task: '', language: 'de' },
      agent: { label: 'AI Agent', status: 'idle', activeAgent: '', itemCount: 0 },
      groq: { label: 'Groq', model: 'llama-3.1-8b-instant', itemCount: 0, status: 'idle' },
      gemini: { label: 'Google Gemini', model: 'gemini-2.0-flash', itemCount: 0, status: 'idle' },
      mistral: { label: 'Mistral', model: 'mistral-small-latest', itemCount: 0, status: 'idle' },
      openrouter: { label: 'OpenRouter', model: 'baidu/cobuddy:free', itemCount: 0, status: 'idle' },
      memory: { strategy: 'sqlite', itemCount: 0 },
      tool: { name: 'new-tool', itemCount: 0 },
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

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  clearExecution: () =>
    set((s) => ({
      messages: [],
      executionState: 'idle',
      nodes: s.nodes.map((n) =>
        n.type === 'agent'
          ? { ...n, data: { ...n.data, status: 'idle', activeAgent: '', itemCount: 0 } }
          : n
      ),
    })),

  resetGraph: () =>
    set({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES, executionState: 'idle', messages: [] }),
}))
