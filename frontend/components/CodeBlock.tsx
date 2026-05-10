'use client'

import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  const lineCount = code.split('\n').length
  const height = Math.min(Math.max(lineCount * 19 + 20, 80), 400)

  return (
    <div className="rounded-md overflow-hidden border border-gray-700 mt-2">
      <MonacoEditor
        height={height}
        language={language}
        value={code}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbers: 'on',
          folding: false,
          wordWrap: 'on',
          scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
          overviewRulerLanes: 0,
        }}
        theme="vs-dark"
      />
    </div>
  )
}
