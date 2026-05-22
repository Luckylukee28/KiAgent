"""
RAG-based code indexing and retrieval for KiAgent.
Enables token-optimized context by retrieving only relevant code snippets.
"""

import os
import re
import ast
import sqlite3
import hashlib
import tempfile
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CodeSnippet:
    file_path: str
    language: str
    name: str
    type: str
    start_line: int
    end_line: int
    code: str
    docstring: Optional[str] = None

    def summary(self) -> str:
        return f"{self.name} ({self.type}) in {self.file_path}"


LANGUAGE_MAP = {
    '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
    '.jsx': 'javascript', '.tsx': 'typescript', '.java': 'java',
    '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c', '.go': 'go',
    '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
}


def detect_language(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    return LANGUAGE_MAP.get(ext, 'unknown')


class CodeParser:
    """Parses code files and extracts function/class snippets."""

    @staticmethod
    def parse_python(file_path: str) -> List[CodeSnippet]:
        snippets = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            tree = ast.parse(content)
            lines = content.split('\n')
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    code = '\n'.join(lines[node.lineno - 1:node.end_lineno])
                    snippets.append(CodeSnippet(
                        file_path=file_path, language='python', name=node.name,
                        type='function', start_line=node.lineno, end_line=node.end_lineno,
                        code=code, docstring=ast.get_docstring(node),
                    ))
                elif isinstance(node, ast.ClassDef):
                    code = '\n'.join(lines[node.lineno - 1:node.end_lineno])
                    snippets.append(CodeSnippet(
                        file_path=file_path, language='python', name=node.name,
                        type='class', start_line=node.lineno, end_line=node.end_lineno,
                        code=code, docstring=ast.get_docstring(node),
                    ))
        except Exception:
            pass
        return snippets

    @staticmethod
    def parse_javascript(file_path: str) -> List[CodeSnippet]:
        snippets = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            func_pattern = r'(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()'
            for match in re.finditer(func_pattern, content):
                name = match.group(1) or match.group(2)
                if not name:
                    continue
                start = content[:match.start()].count('\n') + 1
                end = min(start + 30, content.count('\n') + 1)
                code = '\n'.join(content.split('\n')[start - 1:end])
                snippets.append(CodeSnippet(
                    file_path=file_path, language='javascript', name=name,
                    type='function', start_line=start, end_line=end, code=code,
                ))
        except Exception:
            pass
        return snippets

    @staticmethod
    def parse_text(code: str, language: str = 'python') -> List[CodeSnippet]:
        """Parse code from a string (for pasted code in edit/debug mode)."""
        suffix = '.py' if language == 'python' else '.ts'
        with tempfile.NamedTemporaryFile(mode='w', suffix=suffix, delete=False, encoding='utf-8') as f:
            f.write(code)
            tmp = f.name
        try:
            if language == 'python':
                return CodeParser.parse_python(tmp)
            else:
                return CodeParser.parse_javascript(tmp)
        finally:
            try:
                os.unlink(tmp)
            except Exception:
                pass

    @staticmethod
    def parse_file(file_path: str) -> List[CodeSnippet]:
        lang = detect_language(file_path)
        if lang == 'python':
            return CodeParser.parse_python(file_path)
        elif lang in ('javascript', 'typescript'):
            return CodeParser.parse_javascript(file_path)
        return []


class ProjectIndexer:
    """Indexes a project directory into SQLite."""

    IGNORE_DIRS = {'.git', '__pycache__', 'node_modules', '.venv', 'venv', 'dist', 'build', '.next'}

    def __init__(self, db_path: str = '/tmp/kiagent_rag.db'):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS snippets (
                id INTEGER PRIMARY KEY,
                file_path TEXT, language TEXT, name TEXT, type TEXT,
                start_line INTEGER, end_line INTEGER,
                code TEXT, docstring TEXT, code_hash TEXT UNIQUE,
                project_root TEXT, indexed_at TIMESTAMP
            )''')
            conn.execute('''CREATE TABLE IF NOT EXISTS projects (
                root_path TEXT PRIMARY KEY,
                total_files INTEGER, total_snippets INTEGER,
                languages TEXT, indexed_at TIMESTAMP
            )''')

    def index_project(self, project_root: str) -> dict:
        root = str(Path(project_root).resolve())
        snippets: List[CodeSnippet] = []
        languages = set()
        file_count = 0

        for dirpath, dirnames, files in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in self.IGNORE_DIRS]
            for fname in files:
                fpath = os.path.join(dirpath, fname)
                lang = detect_language(fpath)
                if lang == 'unknown':
                    continue
                languages.add(lang)
                file_count += 1
                snippets.extend(CodeParser.parse_file(fpath))

        self._save_snippets(snippets, root)

        meta = {
            'root_path': root,
            'total_files': file_count,
            'total_snippets': len(snippets),
            'languages': list(languages),
        }
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                'INSERT OR REPLACE INTO projects VALUES (?,?,?,?,?)',
                (root, file_count, len(snippets), ','.join(languages), datetime.now().isoformat())
            )
        return meta

    def _save_snippets(self, snippets: List[CodeSnippet], project_root: str):
        with sqlite3.connect(self.db_path) as conn:
            for s in snippets:
                h = hashlib.md5(s.code.encode()).hexdigest()
                try:
                    conn.execute(
                        'INSERT INTO snippets VALUES (NULL,?,?,?,?,?,?,?,?,?,?,?)',
                        (s.file_path, s.language, s.name, s.type,
                         s.start_line, s.end_line, s.code, s.docstring,
                         h, project_root, datetime.now().isoformat())
                    )
                except sqlite3.IntegrityError:
                    pass

    def get_project_stats(self, project_root: str) -> Optional[dict]:
        root = str(Path(project_root).resolve())
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute('SELECT * FROM projects WHERE root_path=?', (root,)).fetchone()
        if not row:
            return None
        return {'root_path': row[0], 'total_files': row[1], 'total_snippets': row[2],
                'languages': row[3].split(',') if row[3] else [], 'indexed_at': row[4]}


class CodeRetriever:
    """Retrieves relevant code snippets using text-based scoring."""

    @staticmethod
    def retrieve_from_snippets(task: str, snippets: List[CodeSnippet], top_k: int = 6) -> List[CodeSnippet]:
        """Rank snippets by relevance to task using Jaccard similarity."""
        if not snippets:
            return []
        query_words = set(re.findall(r'\w+', task.lower()))
        scored = []
        for s in snippets:
            text = f"{s.name} {s.docstring or ''} {s.type}".lower()
            snippet_words = set(re.findall(r'\w+', text))
            union = query_words | snippet_words
            score = len(query_words & snippet_words) / len(union) if union else 0.0
            scored.append((s, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [s for s, _ in scored[:top_k]]

    @staticmethod
    def retrieve_from_db(task: str, db_path: str, project_root: str, top_k: int = 6) -> List[CodeSnippet]:
        """Retrieve snippets from indexed project in SQLite."""
        try:
            root = str(Path(project_root).resolve())
            with sqlite3.connect(db_path) as conn:
                rows = conn.execute(
                    'SELECT file_path,language,name,type,start_line,end_line,code,docstring '
                    'FROM snippets WHERE project_root=?', (root,)
                ).fetchall()
            snippets = [CodeSnippet(*row) for row in rows]
            return CodeRetriever.retrieve_from_snippets(task, snippets, top_k)
        except Exception:
            return []


VOCAB_DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'vocab.db')


class VocabularyCache:
    """
    Lookup for the 194k multilingual word database.
    Columns: rank, word_en, word_de, word_fr, word_es
    """

    def __init__(self, db_path: str = VOCAB_DB):
        self.db_path = str(Path(db_path).resolve())
        self._available = os.path.exists(self.db_path)

    def lookup(self, word: str, lang: str = 'en') -> Optional[dict]:
        """Return translations for a word. lang = 'en'|'de'|'fr'|'es'."""
        if not self._available:
            return None
        col = {'en': 'word_en', 'de': 'word_de', 'fr': 'word_fr', 'es': 'word_es'}.get(lang, 'word_en')
        try:
            with sqlite3.connect(self.db_path) as conn:
                row = conn.execute(
                    f'SELECT rank, word_en, word_de, word_fr, word_es FROM vocab WHERE {col}=? COLLATE NOCASE',
                    (word.strip(),)
                ).fetchone()
            if row:
                return {'rank': row[0], 'en': row[1], 'de': row[2], 'fr': row[3], 'es': row[4]}
        except Exception:
            pass
        return None

    def enrich_task(self, task: str, lang: str = 'en') -> str:
        """
        Extract keywords from task, look them up in vocab, and append
        a compact translation hint — useful for multilingual code tasks.
        """
        if not self._available:
            return task
        words = list(dict.fromkeys(re.findall(r'\b[a-zA-Z]{4,}\b', task)))[:15]
        hints = []
        for w in words:
            entry = self.lookup(w.lower(), lang='en')
            if entry and entry['de'] and entry['de'].lower() != w.lower():
                hints.append(f"{entry['en']}={entry['de']}")
        if hints:
            return f"{task}\n\n[Vokabular-Hinweise: {', '.join(hints[:8])}]"
        return task


class ContextOptimizer:
    """Builds a token-limited context string from code snippets."""

    @staticmethod
    def estimate_tokens(text: str) -> int:
        return max(1, len(text) // 4)

    @staticmethod
    def build_context(snippets: List[CodeSnippet], task: str, max_tokens: int = 6000) -> str:
        parts = [f"# Relevanter Code-Kontext\n## Aufgabe: {task}\n"]
        used = ContextOptimizer.estimate_tokens(parts[0])
        for s in snippets:
            block = f"\n### {s.file_path} — `{s.name}` ({s.type})\n```{s.language}\n{s.code}\n```\n"
            cost = ContextOptimizer.estimate_tokens(block)
            if used + cost > max_tokens:
                parts.append("\n... (weitere Snippets ausgelassen — Token-Limit)\n")
                break
            parts.append(block)
            used += cost
        return ''.join(parts)

    @staticmethod
    def build_context_from_text(code: str, task: str, max_tokens: int = 6000) -> str:
        """Index pasted code on-the-fly and return optimized context."""
        lang = 'python'
        # Heuristic: detect JS/TS
        if any(kw in code for kw in ('const ', 'function ', '=>', 'interface ', 'export ')):
            lang = 'typescript'
        snippets = CodeParser.parse_text(code, language=lang)
        if not snippets:
            # No parseable snippets: truncate raw code to fit token budget
            truncated = code[:max_tokens * 4]
            return f"# Code\n```\n{truncated}\n```\n"
        relevant = CodeRetriever.retrieve_from_snippets(task, snippets)
        return ContextOptimizer.build_context(relevant, task, max_tokens)
