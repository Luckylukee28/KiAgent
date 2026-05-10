import AgentChat from '@/components/AgentChat'
import TaskInput from '@/components/TaskInput'

export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-gray-950 text-white">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
        <h1 className="text-xl font-bold">Multi-Agent Platform</h1>
        <div className="ml-auto flex gap-2 text-sm text-gray-400 flex-wrap">
          <span className="px-2 py-1 rounded bg-teal-900">📋 PM</span>
          <span className="px-2 py-1 rounded bg-orange-900">🔵 Debate</span>
          <span className="px-2 py-1 rounded bg-yellow-900">⚖️ Judge</span>
          <span className="px-2 py-1 rounded bg-purple-900">🏗️ Architect</span>
          <span className="px-2 py-1 rounded bg-pink-900">🎨 Frontend</span>
          <span className="px-2 py-1 rounded bg-indigo-900">⚙️ Backend</span>
          <span className="px-2 py-1 rounded bg-rose-900">🧠 Self Improver</span>
          <span className="px-2 py-1 rounded bg-green-900">🔍 Reviewer</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <AgentChat />
      </div>
      <TaskInput />
    </main>
  )
}
