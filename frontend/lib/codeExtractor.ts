import type { AgentMessage } from './store'

export interface CodeFile {
  id: string
  name: string       // detected file path or generated name (e.g. "page.tsx")
  language: string   // monaco language id (typescript / python / css / ...)
  content: string
  agent: string      // which agent produced it
  bytes: number
}

const EXT_TO_LANG: Record<string, string> = {
  tsx: 'typescript', ts: 'typescript', jsx: 'javascript', js: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', php: 'php',
  html: 'html', css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini',
  sh: 'shell', bash: 'shell', md: 'markdown', xml: 'xml',
  vue: 'html', svelte: 'html', env: 'shell',
}

const LANG_TO_EXT: Record<string, string> = {
  tsx: 'tsx', jsx: 'jsx', ts: 'ts', typescript: 'ts',
  js: 'js', javascript: 'js', python: 'py', py: 'py',
  go: 'go', rust: 'rs', rs: 'rs', java: 'java', ruby: 'rb',
  html: 'html', css: 'css', scss: 'scss', sass: 'scss',
  sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yml',
  bash: 'sh', sh: 'sh', shell: 'sh', md: 'md', markdown: 'md',
}

function langFromExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANG[ext] ?? 'plaintext'
}

function langFromFence(lang: string): string {
  if (!lang) return 'plaintext'
  const l = lang.toLowerCase()
  return EXT_TO_LANG[l] ?? l
}

function extFromFence(lang: string): string {
  const l = (lang || '').toLowerCase()
  return LANG_TO_EXT[l] ?? 'txt'
}

// Try to find a file path in the few lines preceding a code block.
// Recognised patterns:
//   - `frontend/components/X.tsx`
//   - **X.tsx**
//   - `// X.tsx` or `# X.py`
//   - "File: X.tsx" / "Datei: X.tsx" / "Filename: X.tsx"
function findFileNameNear(text: string): string | null {
  const lines = text.split('\n').slice(-4).reverse()
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // "File: foo.tsx" / "Datei:" / "Filename:"
    const labelled = line.match(/^(?:#+\s*)?(?:File|Datei|Filename|Pfad|Path)\s*[:\-]\s*[`"']?([\w./-]+\.\w+)[`"']?/i)
    if (labelled) return labelled[1]

    // backticks: `foo.tsx` or `frontend/foo.tsx`
    const backtick = line.match(/`([a-zA-Z][\w/.-]*\.\w+)`/)
    if (backtick) return backtick[1]

    // bold: **foo.tsx**
    const bold = line.match(/\*\*([a-zA-Z][\w/.-]*\.\w+)\*\*/)
    if (bold) return bold[1]

    // bare path on its own line
    const bare = line.match(/^([a-zA-Z][\w/.-]*\.\w+)\s*[:\-]?\s*$/)
    if (bare) return bare[1]

    // comment-style header: "// foo.tsx" / "# foo.py" / "/* foo.css */"
    const cmt = line.match(/^(?:\/\/|#|\/\*)\s*([a-zA-Z][\w/.-]*\.\w+)/)
    if (cmt) return cmt[1]
  }
  return null
}

// Try to find a file path in the FIRST line of a code block
// (some agents prefix code with "// path/to/file.ext")
function findFileNameInside(code: string): string | null {
  const firstLine = code.split('\n')[0].trim()
  const m = firstLine.match(/^(?:\/\/|#|--|\/\*)\s*([a-zA-Z][\w/.-]*\.\w+)/)
  return m?.[1] ?? null
}

export function extractCodeFiles(messages: AgentMessage[]): CodeFile[] {
  const files: CodeFile[] = []
  const seen = new Map<string, number>()       // base name → count (for dedup)
  let counter = 0

  const fenceRe = /```([\w+-]*)\n?([\s\S]*?)```/g

  for (const msg of messages) {
    if (msg.agent === 'System') continue

    let m: RegExpExecArray | null
    fenceRe.lastIndex = 0
    while ((m = fenceRe.exec(msg.message)) !== null) {
      const lang = m[1] || ''
      const code = (m[2] || '').trim()
      if (!code || code.length < 4) continue

      // Look for a file name hint
      const before = msg.message.slice(0, m.index)
      let name = findFileNameNear(before) ?? findFileNameInside(code)

      // Fallback: invent name from language
      if (!name) {
        counter++
        const ext = extFromFence(lang)
        const agentSlug = msg.agent.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
        name = `${agentSlug}_snippet_${counter}.${ext}`
      }

      // Dedup file names: append (2), (3) ...
      const baseName = name
      const count = (seen.get(baseName) ?? 0) + 1
      seen.set(baseName, count)
      const finalName = count === 1
        ? baseName
        : baseName.replace(/(\.[^.]+)?$/, (suffix) => ` (${count})${suffix}`)

      const language = lang ? langFromFence(lang) : langFromExt(finalName)

      files.push({
        id: `f-${files.length}`,
        name: finalName,
        language,
        content: code,
        agent: msg.agent,
        bytes: new Blob([code]).size,
      })
    }
  }

  return files
}

export type PreviewKind = 'react' | 'html' | 'vanilla' | 'markdown' | 'css-only'

export interface PreviewResult {
  html: string         // srcDoc for the iframe
  kind: PreviewKind
  label: string        // human-readable description ("React-App", "HTML-Seite", …)
  files: string[]      // names of files used in the preview
}

// Build a smart preview. Auto-detects what kind of project the agents produced
// and picks the right rendering strategy.
export function buildPreview(files: CodeFile[]): PreviewResult | null {
  if (files.length === 0) return null

  // ── 1) React / JSX / TSX project ──────────────────────────────────────────
  const jsxFiles = files.filter(f =>
    /\.(tsx|jsx)$/i.test(f.name) && hasJsx(f.content)
  )
  if (jsxFiles.length > 0) {
    return buildReactPreview(jsxFiles, files)
  }

  // ── 2) HTML document(s) ───────────────────────────────────────────────────
  const htmlFiles = files.filter(f => /\.html?$/i.test(f.name))
  if (htmlFiles.length > 0) {
    return buildHtmlPreview(htmlFiles, files)
  }

  // ── 3) Vanilla JS that produces DOM output ───────────────────────────────
  const jsFiles = files.filter(f => /\.m?js$/i.test(f.name))
  const cssFiles = files.filter(f => /\.s?css$/i.test(f.name))
  if (jsFiles.length > 0 || cssFiles.length > 0) {
    if (jsFiles.length === 0) {
      return buildCssOnlyPreview(cssFiles)
    }
    return buildVanillaPreview(jsFiles, cssFiles)
  }

  // ── 4) Markdown document ──────────────────────────────────────────────────
  const mdFile = files.find(f => /\.md$/i.test(f.name))
  if (mdFile) return buildMarkdownPreview(mdFile)

  return null
}

// ─── Detection helpers ────────────────────────────────────────────────────────

function hasJsx(code: string): boolean {
  // Look for JSX-like tags: <Component, <div className=, <button, …
  // Skip type-only files (no return statement with markup)
  if (!/(?:return\s*\(|=>\s*\()/.test(code) && !/<[A-Z]\w*[\s/>]/.test(code)) return false
  return /<[A-Z]\w*\s*\/?>|<[A-Z]\w*\s[^>]*>|<[a-z]+\s+[a-zA-Z-]+=|<\/[A-Za-z]/.test(code)
}

function pickMainComponent(jsxFiles: CodeFile[]): { file: CodeFile; componentName: string } {
  // Normalised filename for matching: strip " (2)" dedup suffix
  const normName = (n: string) =>
    (n.split('/').pop() ?? '').replace(/\s*\(\d+\)(?=\.\w+$)/, '').toLowerCase()

  const namePatterns = [
    /^app\.(tsx|jsx)$/,
    /^page\.(tsx|jsx)$/,
    /^main\.(tsx|jsx)$/,
    /^home\.(tsx|jsx)$/,
    /^index\.(tsx|jsx)$/,
    /^root\.(tsx|jsx)$/,
  ]
  for (const pat of namePatterns) {
    const found = jsxFiles.find(f => pat.test(normName(f.name)))
    if (found) {
      const base = normName(found.name).replace(/\.(tsx|jsx)$/i, '')
      // Capitalise first letter for component name
      const componentName = base.charAt(0).toUpperCase() + base.slice(1)
      return { file: found, componentName }
    }
  }
  // Look for a default export — prefer files whose default export references other components
  let best: { file: CodeFile; componentName: string } | null = null
  for (const f of jsxFiles) {
    const m = f.content.match(/export\s+default\s+(?:function\s+)?(\w+)/)
    if (m) {
      const candidate = { file: f, componentName: m[1] }
      best = best ?? candidate
      // Prefer one named App/Page/Main/etc.
      if (/^(App|Page|Main|Home|Index|Root)$/i.test(m[1])) return candidate
    }
  }
  if (best) return best

  // Last resort: pick the largest file (most likely the main one)
  const largest = [...jsxFiles].sort((a, b) => b.bytes - a.bytes)[0]
  const base = normName(largest.name).replace(/\.(tsx|jsx)$/i, '')
  const componentName = base.charAt(0).toUpperCase() + base.slice(1).replace(/[^a-z0-9]/gi, '')
  return { file: largest, componentName: componentName || 'App' }
}

// Group files by their logical base name (ignoring " (2)" suffixes) and
// pick one canonical version per base. Prefer Synthesizer, then the latest.
function dedupeByBaseName(files: CodeFile[]): CodeFile[] {
  const byBase = new Map<string, CodeFile[]>()
  for (const f of files) {
    const base = f.name.replace(/\s*\(\d+\)(?=\.\w+$)/, '').toLowerCase()
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base)!.push(f)
  }
  const result: CodeFile[] = []
  for (const variants of byBase.values()) {
    const synth = variants.find(v => /synthe/i.test(v.agent))
    result.push(synth ?? variants[variants.length - 1])
  }
  return result
}

function stripModuleSyntax(code: string): string {
  return code
    // `import X from 'y'` / `import { a, b } from 'y'` / `import 'y'`
    .replace(/^[ \t]*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^[ \t]*import\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    // `export default function X()` → `function X()`; `export default X` → `X`
    .replace(/^[ \t]*export\s+default\s+/gm, '')
    // `export const X = …` → `const X = …`
    .replace(/^[ \t]*export\s+(const|let|var|function|class|async|interface|type|enum)\b/gm, '$1')
    // `export { a, b }` → drop
    .replace(/^[ \t]*export\s+\{[^}]*\}\s*;?\s*$/gm, '')
}

function detectTailwind(...sources: string[]): boolean {
  const blob = sources.join(' ')
  if (!/className\s*=/.test(blob)) return false
  return /\bclassName\s*=\s*["'`][^"'`]*\b(flex|grid|p-\d|m-\d|w-\d|h-\d|text-(xs|sm|base|lg|xl)|bg-\w+-\d|rounded|shadow|gap-\d|space-[xy]-\d)\b/.test(blob)
}

// ─── React preview ────────────────────────────────────────────────────────────

function buildReactPreview(jsxFiles: CodeFile[], allFiles: CodeFile[]): PreviewResult {
  // Dedupe: if multiple agents produced the same logical file, prefer Synthesizer,
  // then the latest version. Keeps Babel from choking on double-declared components.
  const deduped = dedupeByBaseName(jsxFiles)
  const { file: mainFile, componentName } = pickMainComponent(deduped)

  // Put main file last so its declarations override any helpers
  const ordered = [...deduped.filter(f => f.id !== mainFile.id), mainFile]
  const combined = ordered.map(f => stripModuleSyntax(f.content)).join('\n\n// ─── next file ───\n\n')

  const cssFiles = allFiles.filter(f => /\.s?css$/i.test(f.name))
  const css = cssFiles.map(f => f.content).join('\n\n')
  const useTw = detectTailwind(combined, css)

  const escapedName = JSON.stringify(componentName)

  // Collect known function/class names from combined code so we can register
  // them as window globals (Babel scripts don't auto-expose them).
  const declaredNames = new Set<string>()
  const decRe = /(?:^|\n)\s*(?:function|class|const|let|var)\s+([A-Z][\w]*)/g
  let dm: RegExpExecArray | null
  while ((dm = decRe.exec(combined)) !== null) declaredNames.add(dm[1])
  declaredNames.add(componentName)
  const expose = [...declaredNames]
    .map(n => `try { if (typeof ${n} !== 'undefined') window.${n} = ${n}; } catch(_) {}`)
    .join('\n')

  // Source code to be transformed by Babel at runtime (stored as a string)
  const userSource =
    `const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, Fragment, createContext, forwardRef, memo } = React;\n\n` +
    combined + `\n\n` + expose

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>React Preview — ${escapeHtml(componentName)}</title>
<style>
  html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; background: #fff; }
  #__diag { position: fixed; top: 0; left: 0; right: 0; padding: 6px 12px; background: #fef9c3; color: #78350f; font-family: ui-monospace, Menlo, monospace; font-size: 11px; border-bottom: 1px solid #fde68a; z-index: 999999; }
  #__diag.ok { background: #d1fae5; color: #065f46; border-color: #6ee7b7; }
  .__err { color: #991b1b; padding: 14px 16px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; white-space: pre-wrap; border-left: 3px solid #dc2626; background: #fef2f2; margin: 36px 12px 12px; border-radius: 6px; max-height: 70vh; overflow: auto; }
  .__err b { display: block; margin-bottom: 8px; color: #7f1d1d; font-size: 13px; }
  #root { padding-top: 30px; }
</style>
<style id="__user-css">${css}</style>
</head>
<body>
<div id="__diag">⏳ Schritt 1/5: HTML geladen</div>
<div id="root"></div>
<script>
var __errShown = false;
function __setStep(n, msg, ok) {
  var d = document.getElementById('__diag');
  if (!d) return;
  d.textContent = (ok ? '✓ ' : '⏳ ') + 'Schritt ' + n + '/5: ' + msg;
  d.className = ok ? 'ok' : '';
}
function __showErr(title, body) {
  // First useful error wins — don't overwrite with subsequent "Script error." noise
  if (__errShown) return;
  __errShown = true;
  var safe = String(body || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  var html = '<div class="__err"><b>' + title + '</b>' + safe + '</div>';
  var root = document.getElementById('root');
  if (root) root.innerHTML = html;
  else document.body.insertAdjacentHTML('beforeend', html);
}
window.addEventListener('error', function(ev) {
  if (__errShown) return;
  var msg = ev.message || 'Unknown';
  if (ev.filename) msg += '\\nFile: ' + ev.filename + ':' + (ev.lineno || '?');
  if (ev.error && ev.error.stack) msg += '\\n\\n' + ev.error.stack;
  __showErr('Window-Fehler', msg);
});
__setStep(1, 'HTML geladen', true);
</script>

<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin="anonymous"
        onload="__setStep(2, 'React geladen', true)"
        onerror="__showErr('CDN-Fehler', 'React konnte nicht von unpkg.com geladen werden.')"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin="anonymous"
        onload="__setStep(3, 'ReactDOM geladen', true)"
        onerror="__showErr('CDN-Fehler', 'ReactDOM konnte nicht von unpkg.com geladen werden.')"></script>
${useTw ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
<script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin="anonymous"
        onload="__setStep(4, 'Babel geladen — transpiliere…', false); __runPreview()"
        onerror="__showErr('CDN-Fehler', 'Babel konnte nicht von unpkg.com geladen werden.')"></script>

<script>
function __runPreview() {
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof Babel === 'undefined') {
    return __showErr('Bibliotheken fehlen',
      'React: ' + (typeof React) + '\\nReactDOM: ' + (typeof ReactDOM) + '\\nBabel: ' + (typeof Babel));
  }

  var source = ${JSON.stringify(userSource)};
  var compiled;

  try {
    compiled = Babel.transform(source, {
      presets: [
        ['env', { targets: '> 0.25%, not dead', modules: false }],
        'react',
        'typescript'
      ],
      filename: 'preview.tsx'
    }).code;
  } catch (e) {
    return __showErr('Babel-Fehler beim Transpilieren',
      (e && e.message ? e.message : String(e)) +
      (e && e.loc ? '\\n\\nPosition: Zeile ' + e.loc.line + ', Spalte ' + e.loc.column : ''));
  }

  __setStep(5, 'Führe Code aus & rendere…', false);

  // Inject compiled code as a real <script> element. This runs same-origin
  // so any errors thrown carry real stack traces (no "Script error." censorship).
  // Wrap in try/catch INSIDE the script so errors are surfaced cleanly.
  try {
    var wrapped = [
      'try {',
      compiled,
      '} catch (__e) {',
      '  __showErr("Ausführungs-Fehler", (__e && __e.stack) ? __e.stack : (__e && __e.message ? __e.message : String(__e)));',
      '}'
    ].join('\\n');
    var s = document.createElement('script');
    s.text = wrapped;
    document.body.appendChild(s);
  } catch (e) {
    return __showErr('Inject-Fehler',
      (e && e.stack) ? e.stack : (e && e.message ? e.message : String(e)));
  }

  if (__errShown) return;

  var candidates = [${escapedName}, "App", "Page", "Main", "Home", "Index", "Root", "Default"];
  var Comp = null, foundName = null;
  for (var i = 0; i < candidates.length; i++) {
    if (typeof window[candidates[i]] === 'function') {
      Comp = window[candidates[i]]; foundName = candidates[i]; break;
    }
  }
  if (!Comp) {
    for (var key in window) {
      if (/^[A-Z]/.test(key) && typeof window[key] === 'function' && key.length > 1) {
        var src = String(window[key]);
        if (src.indexOf('React.createElement') !== -1) {
          Comp = window[key]; foundName = key; break;
        }
      }
    }
  }
  if (!Comp) {
    var available = Object.keys(window).filter(function(k){return /^[A-Z]/.test(k) && typeof window[k]==='function'}).slice(0, 30);
    return __showErr('Keine Komponente gefunden',
      'Gesucht: App / Page / Main / Home / Index / Root / ${escapeHtml(componentName)}\\n\\n' +
      'Verfügbar (' + available.length + '): ' + (available.join(', ') || '—'));
  }

  try {
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Comp));
    __setStep(5, '<' + foundName + '/> gerendert', true);
    setTimeout(function() {
      var d = document.getElementById('__diag');
      if (d) d.style.display = 'none';
    }, 2000);
  } catch (e) {
    __showErr('Render-Fehler in <' + foundName + '/>',
      (e && e.stack) ? e.stack : (e && e.message ? e.message : String(e)));
  }
}
</script>

<!-- User code wrapped as data; executed by __runPreview above -->
<script id="__user-code" type="text/plain">${combined.replace(/<\/script>/gi, '<\\/script>')}\n\n${expose.replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>`

  return {
    html,
    kind: 'react',
    label: useTw ? `React + Tailwind (${componentName})` : `React (${componentName})`,
    files: ordered.map(f => f.name).concat(cssFiles.map(f => f.name)),
  }
}

// ─── HTML preview ─────────────────────────────────────────────────────────────

function buildHtmlPreview(htmlFiles: CodeFile[], allFiles: CodeFile[]): PreviewResult {
  const main = htmlFiles.find(f => /\bindex\.html?$/i.test(f.name))
            ?? htmlFiles.find(f => /\bmain\.html?$/i.test(f.name))
            ?? [...htmlFiles].sort((a, b) => b.content.length - a.content.length)[0]

  let html = main.content
  const usedFiles: string[] = [main.name]

  // Inline external CSS references
  const cssFiles = allFiles.filter(f => /\.s?css$/i.test(f.name))
  for (const css of cssFiles) {
    const baseName = (css.name.split('/').pop() ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!baseName) continue
    const pat = new RegExp(`<link\\s+[^>]*href=["']?[^"'>]*${baseName}[^"'>]*["']?[^>]*/?>`, 'gi')
    if (pat.test(html)) {
      html = html.replace(pat, `<style>\n${css.content}\n</style>`)
      usedFiles.push(css.name)
    }
  }
  // Append any unreferenced CSS at end of <head>
  const unreferencedCss = cssFiles.filter(c => !usedFiles.includes(c.name))
  if (unreferencedCss.length > 0) {
    const blob = unreferencedCss.map(c => c.content).join('\n\n')
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `<style>\n${blob}\n</style>\n</head>`)
    } else {
      html = `<style>\n${blob}\n</style>\n` + html
    }
    unreferencedCss.forEach(c => usedFiles.push(c.name))
  }

  // Inline external JS references
  const jsFiles = allFiles.filter(f => /\.m?js$/i.test(f.name))
  for (const js of jsFiles) {
    const baseName = (js.name.split('/').pop() ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!baseName) continue
    const pat = new RegExp(`<script\\s+[^>]*src=["']?[^"'>]*${baseName}[^"'>]*["']?[^>]*></script>`, 'gi')
    if (pat.test(html)) {
      html = html.replace(pat, `<script>\n${js.content}\n</script>`)
      usedFiles.push(js.name)
    }
  }

  // Wrap in document if it's just a fragment
  if (!/<html[\s>]/i.test(html)) {
    html = wrapBasic(html, '', '')
  } else if (!/<!DOCTYPE/i.test(html)) {
    html = '<!DOCTYPE html>\n' + html
  }

  return {
    html,
    kind: 'html',
    label: `HTML-Seite (${main.name.split('/').pop()})`,
    files: usedFiles,
  }
}

// ─── Vanilla JS preview ───────────────────────────────────────────────────────

function buildVanillaPreview(jsFiles: CodeFile[], cssFiles: CodeFile[]): PreviewResult {
  const js = jsFiles.map(f => f.content).join('\n\n;\n\n')
  const css = cssFiles.map(f => f.content).join('\n\n')
  return {
    html: wrapBasic('<div id="root"></div><div id="app"></div>', css, js),
    kind: 'vanilla',
    label: `Vanilla JS (${jsFiles.length} ${jsFiles.length === 1 ? 'Datei' : 'Dateien'})`,
    files: [...jsFiles.map(f => f.name), ...cssFiles.map(f => f.name)],
  }
}

// ─── CSS-only preview (show with sample HTML elements) ───────────────────────

function buildCssOnlyPreview(cssFiles: CodeFile[]): PreviewResult {
  const css = cssFiles.map(f => f.content).join('\n\n')
  const body = `
    <main style="padding: 2rem; max-width: 800px; margin: 0 auto;">
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <p>Ein Absatz mit <a href="#">einem Link</a>, <strong>fettem</strong> und <em>kursivem</em> Text.</p>
      <button>Button</button>
      <input type="text" placeholder="Eingabe">
      <ul><li>Liste Item 1</li><li>Liste Item 2</li></ul>
      <pre><code>const x = 42;</code></pre>
    </main>`
  return {
    html: wrapBasic(body, css, ''),
    kind: 'css-only',
    label: `CSS-Vorschau (${cssFiles.length} ${cssFiles.length === 1 ? 'Datei' : 'Dateien'})`,
    files: cssFiles.map(f => f.name),
  }
}

// ─── Markdown preview ─────────────────────────────────────────────────────────

function buildMarkdownPreview(md: CodeFile): PreviewResult {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Markdown Preview</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 820px; margin: 2rem auto; padding: 1.5rem; line-height: 1.7; color: #1f2937; }
  h1, h2, h3, h4 { color: #111827; margin-top: 1.6em; margin-bottom: 0.5em; }
  h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: .3em; }
  pre { background: #1e293b; color: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: .9em; }
  code { background: #f3f4f6; padding: .1em .35em; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  pre code { padding: 0; background: transparent; color: inherit; }
  blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; color: #4b5563; margin-left: 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e5e7eb; padding: .5em 1em; }
  th { background: #f9fafb; text-align: left; }
  img { max-width: 100%; }
</style>
</head>
<body>
<div id="content"></div>
<script>
  const src = ${JSON.stringify(md.content)};
  document.getElementById('content').innerHTML = marked.parse(src);
</script>
</body>
</html>`
  return {
    html,
    kind: 'markdown',
    label: `Markdown (${md.name.split('/').pop()})`,
    files: [md.name],
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function wrapBasic(body: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview</title>
<style>
  html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
${css}
</style>
</head>
<body>
${body}
<script>
try {
${js}
} catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#dc2626;padding:16px">' + (e && e.message ? e.message : e) + '</pre>'); }
</script>
</body>
</html>`
}
