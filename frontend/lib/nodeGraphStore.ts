import { create } from 'zustand'
import {
  Node, Edge, addEdge,
  applyNodeChanges, applyEdgeChanges,
  NodeChange, EdgeChange, Connection,
} from '@xyflow/react'

export type WorkflowNodeType = 'trigger' | 'agent' | 'model' | 'memory' | 'tool'

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

export interface ModelData extends Record<string, unknown> {
  provider: 'groq' | 'gemini' | 'mistral' | 'openrouter'
  model: string
  itemCount: number
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
    id: 'model-1',
    type: 'model',
    position: { x: 240, y: 430 },
    data: { provider: 'groq', model: 'llama-3.1-8b-instant', itemCount: 2 } as ModelData,
  },
  {
    id: 'memory-1',
    type: 'memory',
    position: { x: 450, y: 430 },
    data: { strategy: 'sqlite', itemCount: 2 } as MemoryData,
  },
  {
    id: 'tool-1',
    type: 'tool',
    position: { x: 660, y: 430 },
    data: { name: 'fetch-from-backend', itemCount: 1 } as ToolData,
  },
]

const DEFAULT_EDGES: Edge[] = [
  {
    id: 'e-trigger-agent',
    source: 'trigger-1', target: 'agent-1',
    label: '1 item', animated: true,
    style: EDGE_STYLE, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-model',
    source: 'agent-1', sourceHandle: 'model', target: 'model-1',
    type: 'smoothstep', label: '2 items total',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-memory',
    source: 'agent-1', sourceHandle: 'memory', target: 'memory-1',
    type: 'smoothstep', label: '2 items total',
    style: EDGE_STYLE_DIM, labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG,
  },
  {
    id: 'e-agent-tool',
    source: 'agent-1', sourceHandle: 'tool', target: 'tool-1',
    type: 'smoothstep', label: '1 item',
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
      model: { provider: 'groq', model: 'llama-3.1-8b-instant', itemCount: 0 },
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
