/**
 * ASCII-to-Mermaid conversion utility.
 *
 * Provides a best-effort conversion of ASCII art diagrams (box-drawing,
 * dashed/pipe boxes, arrows) into Mermaid flowchart syntax.
 *
 * This is intentionally "good enough" — complex diagrams will need
 * manual cleanup, but the conversion saves significant time.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AsciiBox {
  /** Unique id generated from position. */
  id: string
  /** Label text found inside the box. */
  label: string
  /** Row of top-left corner. */
  top: number
  /** Column of top-left corner. */
  left: number
  /** Row of bottom-right corner. */
  bottom: number
  /** Column of bottom-right corner. */
  right: number
  /** Center row (for connection detection). */
  cy: number
  /** Center column (for connection detection). */
  cx: number
}

interface AsciiEdge {
  from: string
  to: string
  label?: string
}

// ---------------------------------------------------------------------------
// Character detection helpers
// ---------------------------------------------------------------------------

/** Characters that can form box corners or edges. */
const BOX_CORNERS = new Set([
  '+',
  '┌',
  '┐',
  '└',
  '┘',
  '├',
  '┤',
  '┬',
  '┴',
  '┼',
  '╔',
  '╗',
  '╚',
  '╝',
  '╠',
  '╣',
  '╦',
  '╩',
  '╬',
])

const H_LINE = new Set(['-', '─', '═', '━', '='])
const V_LINE = new Set(['|', '│', '║', '┃'])
const ARROWS_RIGHT = new Set(['→', '▶', '►', '>', '▸', '➜', '➔', '➝'])
const ARROWS_LEFT = new Set(['←', '◀', '◄', '<', '◂', '➜'])
const ARROWS_DOWN = new Set(['↓', '▼', '▾', 'v', 'V'])
const ARROWS_UP = new Set(['↑', '▲', '▴', '^'])

function isHLine(ch: string): boolean {
  return H_LINE.has(ch)
}

function isVLine(ch: string): boolean {
  return V_LINE.has(ch)
}

function isCorner(ch: string): boolean {
  return BOX_CORNERS.has(ch)
}

function isArrowRight(ch: string): boolean {
  return ARROWS_RIGHT.has(ch)
}

function isArrowLeft(ch: string): boolean {
  return ARROWS_LEFT.has(ch)
}

function isArrowDown(ch: string): boolean {
  return ARROWS_DOWN.has(ch)
}

function isArrowUp(ch: string): boolean {
  return ARROWS_UP.has(ch)
}

// ---------------------------------------------------------------------------
// Grid helper
// ---------------------------------------------------------------------------

function toGrid(text: string): string[][] {
  const lines = text.split('\n')
  const maxWidth = Math.max(...lines.map((l) => l.length), 0)
  return lines.map((line) => {
    const chars = Array.from(line)
    while (chars.length < maxWidth) chars.push(' ')
    return chars
  })
}

function charAt(grid: string[][], row: number, col: number): string {
  if (row < 0 || row >= grid.length) return ' '
  if (col < 0 || col >= grid[row].length) return ' '
  return grid[row][col]
}

// ---------------------------------------------------------------------------
// Box detection
// ---------------------------------------------------------------------------

/**
 * Find boxes in the grid by looking for corner characters and tracing
 * horizontal + vertical edges.
 */
function findBoxes(grid: string[][]): AsciiBox[] {
  const boxes: AsciiBox[] = []
  const visited = new Set<string>()

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c]

      // Look for top-left corners
      if (!isCorner(ch) && ch !== '+') continue

      const key = `${r},${c}`
      if (visited.has(key)) continue

      // Trace right along horizontal edge
      let right = c + 1
      while (right < grid[r].length && (isHLine(grid[r][right]) || grid[r][right] === ' ')) {
        right++
      }
      // Must end at a corner
      if (right >= grid[r].length || (!isCorner(grid[r][right]) && grid[r][right] !== '+')) continue

      const boxRight = right

      // Trace down from both top corners
      let bottom = r + 1
      let foundBottom = false
      while (bottom < grid.length) {
        const bl = charAt(grid, bottom, c)
        const br = charAt(grid, bottom, boxRight)

        if ((isCorner(bl) || bl === '+') && (isCorner(br) || br === '+')) {
          // Verify bottom edge exists
          let hasBottomEdge = true
          for (let bc = c + 1; bc < boxRight; bc++) {
            const bch = charAt(grid, bottom, bc)
            if (!isHLine(bch) && bch !== ' ') {
              hasBottomEdge = false
              break
            }
          }
          if (hasBottomEdge) {
            foundBottom = true
            break
          }
        }

        if (!isVLine(bl) && bl !== '|' && !isCorner(bl) && bl !== '+') break
        bottom++
      }

      if (!foundBottom) continue

      // Minimum box size
      if (boxRight - c < 2 || bottom - r < 1) continue

      // Extract label (text inside the box)
      const labelLines: string[] = []
      for (let lr = r + 1; lr < bottom; lr++) {
        let lineText = ''
        for (let lc = c + 1; lc < boxRight; lc++) {
          const lch = charAt(grid, lr, lc)
          if (!isVLine(lch) && !isHLine(lch) && !isCorner(lch)) {
            lineText += lch
          }
        }
        const trimmed = lineText.trim()
        if (trimmed) labelLines.push(trimmed)
      }

      const label = labelLines.join(' ').trim()
      if (!label) continue

      const box: AsciiBox = {
        id: `box_${r}_${c}`,
        label,
        top: r,
        left: c,
        bottom,
        right: boxRight,
        cy: Math.floor((r + bottom) / 2),
        cx: Math.floor((c + boxRight) / 2),
      }

      boxes.push(box)
      visited.add(key)
    }
  }

  return boxes
}

// ---------------------------------------------------------------------------
// Edge detection
// ---------------------------------------------------------------------------

/**
 * Detect connections between boxes by looking for arrows and lines
 * that connect box edges.
 */
function findEdges(grid: string[][], boxes: AsciiBox[]): AsciiEdge[] {
  const edges: AsciiEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(from: string, to: string, label?: string) {
    const key = `${from}->${to}`
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ from, to, label })
    }
  }

  function findBoxNear(row: number, col: number, radius: number = 2): AsciiBox | undefined {
    return boxes.find(
      (b) =>
        row >= b.top - radius &&
        row <= b.bottom + radius &&
        col >= b.left - radius &&
        col <= b.right + radius
    )
  }

  // Scan the entire grid for arrows
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c]

      // Right arrow: trace left to find source box
      if (isArrowRight(ch)) {
        let sc = c - 1
        while (sc >= 0 && (isHLine(charAt(grid, r, sc)) || charAt(grid, r, sc) === ' ')) {
          sc--
        }
        const sourceBox = findBoxNear(r, sc)
        // Trace right from arrow to find target
        let tc = c + 1
        while (tc < grid[r].length && charAt(grid, r, tc) === ' ') tc++
        const targetBox = findBoxNear(r, tc)

        if (sourceBox && targetBox && sourceBox.id !== targetBox.id) {
          addEdge(sourceBox.id, targetBox.id)
        }
      }

      // Left arrow
      if (isArrowLeft(ch)) {
        let tc = c - 1
        while (tc >= 0 && charAt(grid, r, tc) === ' ') tc--
        const targetBox = findBoxNear(r, tc)

        let sc = c + 1
        while (
          sc < grid[r].length &&
          (isHLine(charAt(grid, r, sc)) || charAt(grid, r, sc) === ' ')
        ) {
          sc++
        }
        const sourceBox = findBoxNear(r, sc)

        if (sourceBox && targetBox && sourceBox.id !== targetBox.id) {
          addEdge(sourceBox.id, targetBox.id)
        }
      }

      // Down arrow
      if (isArrowDown(ch)) {
        let sr = r - 1
        while (sr >= 0 && (isVLine(charAt(grid, sr, c)) || charAt(grid, sr, c) === ' ')) {
          sr--
        }
        const sourceBox = findBoxNear(sr, c)

        let tr = r + 1
        while (tr < grid.length && charAt(grid, tr, c) === ' ') tr++
        const targetBox = findBoxNear(tr, c)

        if (sourceBox && targetBox && sourceBox.id !== targetBox.id) {
          addEdge(sourceBox.id, targetBox.id)
        }
      }

      // Up arrow
      if (isArrowUp(ch)) {
        let tr = r - 1
        while (tr >= 0 && charAt(grid, tr, c) === ' ') tr--
        const targetBox = findBoxNear(tr, c)

        let sr = r + 1
        while (sr < grid.length && (isVLine(charAt(grid, sr, c)) || charAt(grid, sr, c) === ' ')) {
          sr++
        }
        const sourceBox = findBoxNear(sr, c)

        if (sourceBox && targetBox && sourceBox.id !== targetBox.id) {
          addEdge(sourceBox.id, targetBox.id)
        }
      }
    }
  }

  // Also detect direct adjacency — boxes connected by lines without explicit arrows
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]

      // Horizontal connection: boxes on same row range
      if (Math.abs(a.cy - b.cy) <= 1) {
        const leftBox = a.cx < b.cx ? a : b
        const rightBox = a.cx < b.cx ? b : a

        // Check for a line between them
        let hasLine = false
        const midRow = Math.floor((leftBox.cy + rightBox.cy) / 2)
        for (let c = leftBox.right + 1; c < rightBox.left; c++) {
          const ch = charAt(grid, midRow, c)
          if (isHLine(ch)) {
            hasLine = true
            break
          }
        }
        if (hasLine) {
          addEdge(leftBox.id, rightBox.id)
        }
      }

      // Vertical connection: boxes on same column range
      if (Math.abs(a.cx - b.cx) <= 2) {
        const topBox = a.cy < b.cy ? a : b
        const bottomBox = a.cy < b.cy ? b : a

        let hasLine = false
        const midCol = Math.floor((topBox.cx + bottomBox.cx) / 2)
        for (let r = topBox.bottom + 1; r < bottomBox.top; r++) {
          const ch = charAt(grid, r, midCol)
          if (isVLine(ch) || ch === '|') {
            hasLine = true
            break
          }
        }
        if (hasLine) {
          addEdge(topBox.id, bottomBox.id)
        }
      }
    }
  }

  return edges
}

// ---------------------------------------------------------------------------
// Subgraph detection
// ---------------------------------------------------------------------------

/**
 * Detect subgraphs: a box that contains other boxes.
 */
function detectSubgraphs(boxes: AsciiBox[]): { parent: AsciiBox; children: AsciiBox[] }[] {
  const subgraphs: { parent: AsciiBox; children: AsciiBox[] }[] = []

  for (const outer of boxes) {
    const contained = boxes.filter(
      (inner) =>
        inner.id !== outer.id &&
        inner.top > outer.top &&
        inner.bottom < outer.bottom &&
        inner.left > outer.left &&
        inner.right < outer.right
    )
    if (contained.length > 0) {
      subgraphs.push({ parent: outer, children: contained })
    }
  }

  return subgraphs
}

// ---------------------------------------------------------------------------
// Mermaid generation
// ---------------------------------------------------------------------------

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

function sanitizeLabel(label: string): string {
  // Escape quotes and brackets for Mermaid
  return label.replace(/"/g, "'").replace(/\[/g, '(').replace(/\]/g, ')')
}

/**
 * Convert ASCII art text to Mermaid flowchart syntax.
 *
 * @param text - The ASCII art string
 * @returns Mermaid flowchart code
 */
export function asciiToMermaid(text: string): string {
  const grid = toGrid(text)
  const allBoxes = findBoxes(grid)

  if (allBoxes.length === 0) {
    // Fallback: try to extract anything that looks like labeled items
    return generateFallbackMermaid(text)
  }

  const edges = findEdges(grid, allBoxes)
  const subgraphs = detectSubgraphs(allBoxes)

  // Find boxes that are subgraph parents
  const parentIds = new Set(subgraphs.map((sg) => sg.parent.id))
  // Find boxes that are subgraph children
  const childIds = new Set(subgraphs.flatMap((sg) => sg.children.map((c) => c.id)))

  const lines: string[] = ['graph TD']

  // Render subgraphs
  for (const sg of subgraphs) {
    const parentLabel = sanitizeLabel(sg.parent.label)
    lines.push(`    subgraph ${sanitizeId(sg.parent.id)}["${parentLabel}"]`)
    for (const child of sg.children) {
      const childLabel = sanitizeLabel(child.label)
      lines.push(`        ${sanitizeId(child.id)}["${childLabel}"]`)
    }
    lines.push('    end')
  }

  // Render standalone nodes (not parents or children)
  for (const box of allBoxes) {
    if (!parentIds.has(box.id) && !childIds.has(box.id)) {
      const label = sanitizeLabel(box.label)
      lines.push(`    ${sanitizeId(box.id)}["${label}"]`)
    }
  }

  // Render edges
  for (const edge of edges) {
    const fromId = sanitizeId(edge.from)
    const toId = sanitizeId(edge.to)
    if (edge.label) {
      lines.push(`    ${fromId} -->|"${sanitizeLabel(edge.label)}"| ${toId}`)
    } else {
      lines.push(`    ${fromId} --> ${toId}`)
    }
  }

  // If no edges were detected, connect boxes in reading order
  if (edges.length === 0 && allBoxes.length > 1) {
    const sorted = [...allBoxes]
      .filter((b) => !parentIds.has(b.id))
      .sort((a, b) => a.top - b.top || a.left - b.left)

    for (let i = 0; i < sorted.length - 1; i++) {
      lines.push(`    ${sanitizeId(sorted[i].id)} --> ${sanitizeId(sorted[i + 1].id)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Fallback for text that doesn't have clear box-drawing characters.
 * Tries to extract labeled items from lines and create a simple flow.
 */
function generateFallbackMermaid(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const nodes: { id: string; label: string }[] = []

  for (const line of lines) {
    // Skip pure decoration lines
    if (/^[-=+─│┌┐└┘|*]+$/.test(line)) continue

    // Extract text from lines that look like labels
    const cleaned = line.replace(/[─│┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬|+\-=]/g, '').trim()

    if (cleaned && cleaned.length > 1) {
      const id = 'node_' + nodes.length
      nodes.push({ id, label: sanitizeLabel(cleaned) })
    }
  }

  if (nodes.length === 0) {
    return 'graph TD\n    A["No diagram structure detected"]'
  }

  const mermaidLines = ['graph TD']
  for (const node of nodes) {
    mermaidLines.push(`    ${node.id}["${node.label}"]`)
  }
  for (let i = 0; i < nodes.length - 1; i++) {
    mermaidLines.push(`    ${nodes[i].id} --> ${nodes[i + 1].id}`)
  }

  return mermaidLines.join('\n')
}

/**
 * Detect if a text block looks like an ASCII diagram.
 * Returns true if it contains enough box-drawing or diagram characters.
 */
export function looksLikeAsciiDiagram(text: string): boolean {
  const boxChars = /[┌┐└┘├┤┬┴┼─│╔╗╚╝╠╣╦╩╬═║]/g
  const pipeBoxChars = /\+[-=]+\+/g
  const arrowChars = /[→←↓↑▼▲▶◀►◄▸◂➜➔➝]/g

  const boxMatches = (text.match(boxChars) || []).length
  const pipeMatches = (text.match(pipeBoxChars) || []).length
  const arrowMatches = (text.match(arrowChars) || []).length

  // Also check for ASCII-style boxes: +---+
  const asciiBoxPattern = /\+[-=]+\+/
  const pipePattern = /\|[^|]+\|/
  const hasAsciiBoxes = asciiBoxPattern.test(text) && pipePattern.test(text)

  return boxMatches >= 4 || pipeMatches >= 2 || arrowMatches >= 2 || hasAsciiBoxes
}
