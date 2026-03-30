// ---------------------------------------------------------------------------
// Frontmatter parsing (browser-safe, no Node.js deps)
// ---------------------------------------------------------------------------

export interface ParsedFrontmatter {
  data: Record<string, unknown>
  content: string
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  try {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (!match) return { data: {}, content: raw }

    const yamlBlock = match[1]
    const content = match[2]

    // Simple YAML key: value parser (handles strings, numbers, booleans, arrays)
    const data: Record<string, unknown> = {}
    for (const line of yamlBlock.split('\n')) {
      const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
      if (!kv) continue
      const [, key, rawVal] = kv
      let val: unknown = rawVal.trim()

      // Remove quotes
      if ((val as string).startsWith('"') && (val as string).endsWith('"'))
        val = (val as string).slice(1, -1)
      else if ((val as string).startsWith("'") && (val as string).endsWith("'"))
        val = (val as string).slice(1, -1)
      // Booleans
      else if (val === 'true') val = true
      else if (val === 'false') val = false
      // Numbers
      else if (!isNaN(Number(val)) && (val as string) !== '') val = Number(val)
      // Inline arrays [a, b, c]
      else if ((val as string).startsWith('[') && (val as string).endsWith(']'))
        val = (val as string)
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))

      data[key] = val
    }

    return { data, content }
  } catch {
    return { data: {}, content: raw }
  }
}

// ---------------------------------------------------------------------------
// Language extension map (for "Export as File")
// ---------------------------------------------------------------------------

export const LANG_EXT_MAP: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  ruby: 'rb',
  go: 'go',
  rust: 'rs',
  java: 'java',
  kotlin: 'kt',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  css: 'css',
  html: 'html',
  json: 'json',
  yaml: 'yaml',
  yml: 'yml',
  toml: 'toml',
  xml: 'xml',
  sql: 'sql',
  bash: 'sh',
  shell: 'sh',
  sh: 'sh',
  zsh: 'sh',
  dockerfile: 'Dockerfile',
  markdown: 'md',
  md: 'md',
  php: 'php',
  lua: 'lua',
  dart: 'dart',
  scala: 'scala',
  r: 'r',
  perl: 'pl',
  powershell: 'ps1',
  graphql: 'graphql',
  proto: 'proto',
  protobuf: 'proto',
  makefile: 'Makefile',
  cmake: 'cmake',
  nginx: 'conf',
  ini: 'ini',
  plaintext: 'txt',
  text: 'txt',
  txt: 'txt',
}

export function getExtForLang(lang: string): string {
  return LANG_EXT_MAP[lang.toLowerCase()] ?? 'txt'
}
