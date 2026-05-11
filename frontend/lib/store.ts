import { create } from 'zustand'

export interface AgentMessage {
  id: string
  agent: string
  message: string
  timestamp: Date
}

export interface SavedSession {
  id: string
  goal: string
  savedAt: string
  messages: AgentMessage[]
}

export type Language = 'de' | 'en'
export type Status = 'idle' | 'thinking' | 'working'

const THINKING_PHRASES = [
  'Erarbeite Lösung...', 'Working on solution...',
  'Überprüfe und verbessere', 'Reviewing and improving',
  'Kombiniere', 'Combining',
  'Erstelle Projektplan', 'Creating project plan',
  'Architektur-Debatte', 'Starting architecture debate',
  'Bewerte Outputs', 'Evaluating outputs',
  'Paralleles Coding', 'Parallel coding',
  'arbeiten gemeinsam', 'collaborating on',
  'reviewen gemeinsam', 'reviewing code',
]

function detectStatus(message: string): Status {
  for (const phrase of THINKING_PHRASES) {
    if (message.includes(phrase)) return 'thinking'
  }
  return 'working'
}

function loadSessions(): SavedSession[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('mindmap-sessions') || '[]')
  } catch { return [] }
}

function saveSessions(sessions: SavedSession[]) {
  localStorage.setItem('mindmap-sessions', JSON.stringify(sessions.slice(0, 20)))
}

interface AgentStore {
  messages: AgentMessage[]
  isRunning: boolean
  status: Status
  activeAgent: string
  language: Language
  goal: string
  sessions: SavedSession[]
  addMessage: (msg: Omit<AgentMessage, 'id' | 'timestamp'>) => void
  setRunning: (v: boolean) => void
  clearMessages: () => void
  setLanguage: (lang: Language) => void
  setGoal: (goal: string) => void
  saveCurrentSession: () => void
  loadSession: (session: SavedSession) => void
  deleteSession: (id: string) => void
  newProject: () => void
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  messages: [],
  isRunning: false,
  status: 'idle',
  activeAgent: '',
  language: 'de',
  goal: '',
  sessions: loadSessions(),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
      status: state.isRunning ? detectStatus(msg.message) : 'idle',
      activeAgent: state.isRunning ? msg.agent : '',
    })),

  setRunning: (v) => set({ isRunning: v, status: v ? 'thinking' : 'idle', activeAgent: '' }),
  clearMessages: () => set({ messages: [] }),
  setLanguage: (lang) => set({ language: lang }),
  setGoal: (goal) => set({ goal }),

  saveCurrentSession: () => {
    const { messages, goal } = get()
    if (!goal || messages.length === 0) return
    const session: SavedSession = {
      id: crypto.randomUUID(),
      goal,
      savedAt: new Date().toISOString(),
      messages,
    }
    const updated = [session, ...loadSessions()]
    saveSessions(updated)
    set({ sessions: updated })
  },

  loadSession: (session) => {
    set({ messages: session.messages, goal: session.goal, status: 'idle', isRunning: false })
  },

  deleteSession: (id) => {
    const updated = loadSessions().filter((s) => s.id !== id)
    saveSessions(updated)
    set({ sessions: updated })
  },

  newProject: () => {
    const { saveCurrentSession } = get()
    saveCurrentSession()
    set({ messages: [], goal: '', status: 'idle', isRunning: false, activeAgent: '' })
  },
}))
