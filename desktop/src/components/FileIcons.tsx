// Orchestra Desktop — Material Design File Icons
//
// SVG icon components matching the VS Code Material Icon Theme colors.

import React from 'react'

const iconClass = 'h-4 w-4 shrink-0'

// ─── Folder Icons ────────────────────────────────────────────────

export function FolderIcon({ open: isOpen, color }: { open?: boolean; color?: string }) {
  const c = color || '#90a4ae'
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      {isOpen ? (
        <>
          <path
            d="M2 6V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V8C22 6.9 21.1 6 20 6H12L10 4H4C2.9 4 2 4.9 2 6Z"
            fill={c}
            opacity="0.3"
          />
          <path d="M20 8H4L2 20H22L20 8Z" fill={c} />
        </>
      ) : (
        <path
          d="M2 6V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V8C22 6.9 21.1 6 20 6H12L10 4H4C2.9 4 2 4.9 2 6Z"
          fill={c}
        />
      )}
    </svg>
  )
}

export function ClaudeFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#ab47bc" />
}

export function AgentsFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#7c4dff" />
}

export function SkillsFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#ffd600" />
}

export function RulesFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#ff9100" />
}

export function PlansFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#66bb6a" />
}

export function SpecFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#42a5f5" />
}

export function DocsFolderIcon({ open: isOpen }: { open?: boolean }) {
  return <FolderIcon open={isOpen} color="#26a69a" />
}

// ─── File Icons ──────────────────────────────────────────────────

/** Markdown .md — green */
export function MarkdownFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#4caf50" opacity="0.15" />
      <path d="M5 17V7H7.5L10 10.5L12.5 7H15V17H12.5V10.5L10 14L7.5 10.5V17H5Z" fill="#4caf50" />
      <path d="M17 14L20 17V10L17 14Z" fill="#4caf50" />
    </svg>
  )
}

/** CLAUDE.md — special green/teal with C badge */
export function ClaudeMdFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#009688" opacity="0.15" />
      <path d="M5 17V7H7.5L10 10.5L12.5 7H15V17H12.5V10.5L10 14L7.5 10.5V17H5Z" fill="#009688" />
      <circle cx="19" cy="5" r="4" fill="#009688" />
      <text
        x="19"
        y="7"
        textAnchor="middle"
        fill="white"
        fontSize="6"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        C
      </text>
    </svg>
  )
}

/** README.md — blue book icon */
export function ReadmeFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 4C3 3.45 3.45 3 4 3H11C11.55 3 12 3.45 12 4V20C12 20.55 11.55 21 11 21H4C3.45 21 3 20.55 3 20V4Z"
        fill="#42a5f5"
        opacity="0.2"
      />
      <path
        d="M12 4C12 3.45 12.45 3 13 3H20C20.55 3 21 3.45 21 4V20C21 20.55 20.55 21 20 21H13C12.45 21 12 20.55 12 20V4Z"
        fill="#42a5f5"
        opacity="0.2"
      />
      <path
        d="M3 5C3 3.9 3.9 3 5 3H10.5C11.33 3 12 3.67 12 4.5V19.5C12 19.5 10.5 18 8.5 18H3V5Z"
        stroke="#42a5f5"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M21 5C21 3.9 20.1 3 19 3H13.5C12.67 3 12 3.67 12 4.5V19.5C12 19.5 13.5 18 15.5 18H21V5Z"
        stroke="#42a5f5"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

/** Agent files — robot icon in purple */
export function AgentFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect
        x="5"
        y="4"
        width="14"
        height="10"
        rx="3"
        fill="#7c4dff"
        opacity="0.15"
        stroke="#7c4dff"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="9" r="1.5" fill="#7c4dff" />
      <circle cx="15" cy="9" r="1.5" fill="#7c4dff" />
      <path
        d="M8 14V17C8 18.1 8.9 19 10 19H14C15.1 19 16 18.1 16 17V14"
        stroke="#7c4dff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M3 9H5M19 9H21" stroke="#7c4dff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4V2" stroke="#7c4dff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Skill files — lightning in yellow */
export function SkillFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <path
        d="M13 2L4 14H12L11 22L20 10H12L13 2Z"
        fill="#ffd600"
        opacity="0.2"
        stroke="#ffc107"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Rule files — shield in orange */
export function RuleFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2Z"
        fill="#ff9100"
        opacity="0.15"
        stroke="#ff9100"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke="#ff9100"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Plan files — notepad in green */
export function PlanFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
        fill="#66bb6a"
        opacity="0.15"
        stroke="#66bb6a"
        strokeWidth="1.5"
      />
      <path d="M8 7H16M8 11H16M8 15H13" stroke="#66bb6a" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="8" y="1" width="3" height="4" rx="0.5" fill="#66bb6a" />
      <rect x="13" y="1" width="3" height="4" rx="0.5" fill="#66bb6a" />
    </svg>
  )
}

/** Spec files — blueprint in blue */
export function SpecFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z"
        fill="#42a5f5"
        opacity="0.15"
        stroke="#42a5f5"
        strokeWidth="1.5"
      />
      <path d="M14 2V8H20" stroke="#42a5f5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 13H16M8 17H12" stroke="#42a5f5" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** Doc files — folder/doc in teal */
export function DocFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z"
        fill="#26a69a"
        opacity="0.15"
        stroke="#26a69a"
        strokeWidth="1.5"
      />
      <path d="M14 2V8H20" stroke="#26a69a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 13H16M8 17H12" stroke="#26a69a" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** JSON files — yellow/orange */
export function JsonFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#ffa726" opacity="0.15" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#ffa726"
        fontSize="8"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {'{}'}
      </text>
    </svg>
  )
}

/** YAML files — purple */
export function YamlFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#ab47bc" opacity="0.15" />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fill="#ab47bc"
        fontSize="7"
        fontWeight="bold"
        fontFamily="monospace"
      >
        YML
      </text>
    </svg>
  )
}

/** TypeScript files — blue */
export function TypeScriptFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#1976d2" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="white"
        fontSize="9"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        TS
      </text>
    </svg>
  )
}

/** JavaScript files — yellow */
export function JavaScriptFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#f7df1e" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#333"
        fontSize="9"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        JS
      </text>
    </svg>
  )
}

/** Go files — cyan */
export function GoFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#00bcd4" opacity="0.15" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#00acc1"
        fontSize="9"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        Go
      </text>
    </svg>
  )
}

/** Rust files — orange */
export function RustFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#ff7043" opacity="0.15" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#e64a19"
        fontSize="8"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        RS
      </text>
    </svg>
  )
}

/** PHP files — purple */
export function PhpFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="7"
        fill="#7b1fa2"
        opacity="0.15"
        stroke="#7b1fa2"
        strokeWidth="1.5"
      />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fill="#7b1fa2"
        fontSize="7"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        PHP
      </text>
    </svg>
  )
}

/** CSS files — blue */
export function CssFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#1565c0" opacity="0.15" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#1565c0"
        fontSize="8"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        CSS
      </text>
    </svg>
  )
}

/** HTML files — orange */
export function HtmlFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#e65100" opacity="0.15" />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fill="#e65100"
        fontSize="6"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {'<>'}
      </text>
    </svg>
  )
}

/** SVG files — gold */
export function SvgFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#ffab00" opacity="0.15" />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fill="#ffab00"
        fontSize="7"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        SVG
      </text>
    </svg>
  )
}

/** Image files — green */
export function ImageFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        fill="#66bb6a"
        opacity="0.15"
        stroke="#66bb6a"
        strokeWidth="1.5"
      />
      <circle cx="8.5" cy="8.5" r="2" fill="#66bb6a" />
      <path d="M21 15L16 10L5 21H19C20.1 21 21 20.1 21 19V15Z" fill="#66bb6a" opacity="0.3" />
    </svg>
  )
}

/** Python files — blue/yellow */
export function PythonFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#1565c0" opacity="0.1" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#1976d2"
        fontSize="8"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        PY
      </text>
    </svg>
  )
}

/** Default/generic file — gray */
export function GenericFileIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z"
        fill="#90a4ae"
        opacity="0.15"
        stroke="#90a4ae"
        strokeWidth="1.5"
      />
      <path d="M14 2V8H20" stroke="#90a4ae" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Resolution Helpers ──────────────────────────────────────────

/** Get a folder icon based on the folder name */
export function getFolderIcon(folderName: string, isOpen: boolean): React.ReactNode {
  const name = folderName.toLowerCase().replace(/^\./, '')
  switch (name) {
    case 'claude':
      return <ClaudeFolderIcon open={isOpen} />
    case 'agents':
      return <AgentsFolderIcon open={isOpen} />
    case 'skills':
      return <SkillsFolderIcon open={isOpen} />
    case 'rules':
      return <RulesFolderIcon open={isOpen} />
    case 'plans':
    case '.plans':
      return <PlansFolderIcon open={isOpen} />
    case 'spec':
    case 'specs':
      return <SpecFolderIcon open={isOpen} />
    case 'docs':
    case 'doc':
      return <DocsFolderIcon open={isOpen} />
    default:
      return <FolderIcon open={isOpen} />
  }
}

/** Get a file icon based on the filename/type/path */
export function getFileIcon(
  fileName: string,
  fileType?: string,
  parentPath?: string
): React.ReactNode {
  const lower = fileName.toLowerCase()
  const ext = lower.split('.').pop() || ''

  // Special files first
  if (lower === 'claude.md') return <ClaudeMdFileIcon />
  if (lower === 'readme.md' || lower === 'readme') return <ReadmeFileIcon />

  // File type from workspace scanner
  if (fileType) {
    switch (fileType) {
      case 'agent':
        return <AgentFileIcon />
      case 'skill':
        return <SkillFileIcon />
      case 'rule':
        return <RuleFileIcon />
      case 'plan':
        return <PlanFileIcon />
      case 'spec':
        return <SpecFileIcon />
      case 'doc':
        return <DocFileIcon />
      case 'claude-md':
        return <ClaudeMdFileIcon />
      case 'readme':
        return <ReadmeFileIcon />
    }
  }

  // Path-based detection
  if (parentPath) {
    const pLower = parentPath.toLowerCase()
    if (pLower.includes('/agents/') || pLower.includes('\\agents\\')) return <AgentFileIcon />
    if (pLower.includes('/skills/') || pLower.includes('\\skills\\')) return <SkillFileIcon />
    if (pLower.includes('/rules/') || pLower.includes('\\rules\\')) return <RuleFileIcon />
    if (pLower.includes('/plans/') || pLower.includes('\\.plans\\')) return <PlanFileIcon />
    if (pLower.includes('/spec/') || pLower.includes('\\spec\\')) return <SpecFileIcon />
    if (pLower.includes('/docs/') || pLower.includes('\\docs\\')) return <DocFileIcon />
  }

  // Extension-based
  switch (ext) {
    case 'md':
    case 'mdx':
      return <MarkdownFileIcon />
    case 'json':
    case 'jsonc':
      return <JsonFileIcon />
    case 'yml':
    case 'yaml':
      return <YamlFileIcon />
    case 'ts':
    case 'tsx':
      return <TypeScriptFileIcon />
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <JavaScriptFileIcon />
    case 'go':
      return <GoFileIcon />
    case 'rs':
      return <RustFileIcon />
    case 'php':
      return <PhpFileIcon />
    case 'py':
      return <PythonFileIcon />
    case 'css':
    case 'scss':
    case 'less':
      return <CssFileIcon />
    case 'html':
    case 'htm':
      return <HtmlFileIcon />
    case 'svg':
      return <SvgFileIcon />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'bmp':
      return <ImageFileIcon />
    default:
      return <GenericFileIcon />
  }
}
