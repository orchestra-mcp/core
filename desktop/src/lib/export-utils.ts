/**
 * Export utilities for Orchestra Desktop markdown renderer.
 * Provides image export (html2canvas), CSV/file export (Tauri dialogs),
 * clipboard operations, and table data extraction.
 */

import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import html2canvas from 'html2canvas'

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

// ---------------------------------------------------------------------------
// Export as Image (PNG via html2canvas)
// ---------------------------------------------------------------------------

export async function exportAsImage(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#121212',
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png')
  })

  const selected = await save({
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
    defaultPath: filename.endsWith('.png') ? filename : `${filename}.png`,
  })
  if (!selected) return

  const arrayBuf = await blob.arrayBuffer()
  await writeFile(selected, new Uint8Array(arrayBuf))
}

// ---------------------------------------------------------------------------
// Export as CSV
// ---------------------------------------------------------------------------

export function dataToCSV(data: string[][]): string {
  return data
    .map((row) =>
      row
        .map((cell) => {
          const escaped = cell.replace(/"/g, '""')
          return /[,"\n\r]/.test(cell) ? `"${escaped}"` : escaped
        })
        .join(',')
    )
    .join('\n')
}

export async function exportAsCSV(data: string[][], filename: string): Promise<void> {
  const csv = dataToCSV(data)

  const selected = await save({
    filters: [{ name: 'CSV File', extensions: ['csv'] }],
    defaultPath: filename.endsWith('.csv') ? filename : `${filename}.csv`,
  })
  if (!selected) return

  await writeTextFile(selected, csv)
}

// ---------------------------------------------------------------------------
// Export as generic file
// ---------------------------------------------------------------------------

export async function exportAsFile(content: string, filename: string, ext: string): Promise<void> {
  const cleanExt = ext.replace(/^\./, '')
  const defaultName = filename.endsWith(`.${cleanExt}`) ? filename : `${filename}.${cleanExt}`

  const selected = await save({
    filters: [{ name: cleanExt.toUpperCase(), extensions: [cleanExt] }],
    defaultPath: defaultName,
  })
  if (!selected) return

  await writeTextFile(selected, content)
}

// ---------------------------------------------------------------------------
// Table extraction helpers
// ---------------------------------------------------------------------------

/** Extract a 2D string array from an HTMLTableElement. */
export function tableToData(tableElement: HTMLTableElement): string[][] {
  const rows: string[][] = []

  // Header rows
  const thead = tableElement.querySelector('thead')
  if (thead) {
    for (const tr of Array.from(thead.querySelectorAll('tr'))) {
      const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
        (c as HTMLElement).innerText.trim()
      )
      rows.push(cells)
    }
  }

  // Body rows
  const tbody = tableElement.querySelector('tbody') ?? tableElement
  for (const tr of Array.from(tbody.querySelectorAll('tr'))) {
    const cells = Array.from(tr.querySelectorAll('td, th')).map((c) =>
      (c as HTMLElement).innerText.trim()
    )
    if (cells.length > 0) rows.push(cells)
  }

  return rows
}

/** Convert table data to CSV string. */
export function tableToCSV(tableElement: HTMLTableElement): string {
  return dataToCSV(tableToData(tableElement))
}

/** Convert table data to a markdown table string. */
export function tableToMarkdown(tableElement: HTMLTableElement): string {
  const data = tableToData(tableElement)
  if (data.length === 0) return ''

  const header = data[0]
  const colWidths = header.map((_, ci) => Math.max(3, ...data.map((row) => (row[ci] ?? '').length)))

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length))
  const formatRow = (row: string[]) =>
    '| ' + row.map((c, i) => pad(c, colWidths[i])).join(' | ') + ' |'

  const lines: string[] = []
  lines.push(formatRow(header))
  lines.push('| ' + colWidths.map((w) => '-'.repeat(w)).join(' | ') + ' |')
  for (let r = 1; r < data.length; r++) {
    lines.push(formatRow(data[r]))
  }

  return lines.join('\n')
}

/** Convert table data to tab-separated plain text. */
export function tableToPlainText(tableElement: HTMLTableElement): string {
  return tableToData(tableElement)
    .map((row) => row.join('\t'))
    .join('\n')
}
