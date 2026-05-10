import { create } from 'zustand'

export interface AgentMessage {
  id: string
  agent: string
  message: string
  timestamp: Date
}

export type Language = 'de' | 'en'

interface AgentStore {
  messages: AgentMessage[]
  isRunning: boolean
  language: Language
  addMessage: (msg: Omit<AgentMessage, 'id' | 'timestamp'>) => void
  setRunning: (v: boolean) => void
  clearMessages: () => void
  setLanguage: (lang: Language) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  messages: [],
  isRunning: false,
  language: 'de',
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),
  setRunning: (v) => set({ isRunning: v }),
  clearMessages: () => set({ messages: [] }),
  setLanguage: (lang) => set({ language: lang }),
}))
