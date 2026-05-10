'use client'

import { useAgentStore } from '@/lib/store'

export default function LanguageToggle() {
  const { language, setLanguage } = useAgentStore()

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => setLanguage('de')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          language === 'de'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        🇩🇪 DE
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          language === 'en'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        🇬🇧 EN
      </button>
    </div>
  )
}
