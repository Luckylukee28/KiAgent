import { create } from 'zustand'

export interface AgentMessage {
  id: string
  agent: string
  message: string
  timestamp: Date
}

interface AgentStore {
  messages: AgentMessage[]
  isRunning: boolean
  addMessage: (msg: Omit<AgentMessage, 'id' | 'timestamp'>) => void
  setRunning: (v: boolean) => void
  clearMessages: () => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  messages: [],
  isRunning: false,
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),
  setRunning: (v) => set({ isRunning: v }),
  clearMessages: () => set({ messages: [] }),
}))
