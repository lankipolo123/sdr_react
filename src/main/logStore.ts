import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname } from 'path'
import type { LogEntry } from './channelController'

// Permanent, append-only internal command log - separate from the
// live in-memory 'log:entry' stream the renderer already gets (which
// only feeds the ephemeral corner box / Dashboard on the Commands
// page). This is the actual audit trail: every entry ever sent gets
// appended here and it is never truncated or rewritten by this
// module - there is deliberately no delete/clear function in this
// file. One JSON object per line (JSON Lines), append-only so writing
// never has to re-read or rewrite the whole file.

export function appendLogEntry(entry: LogEntry, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8')
}

export interface LogPage {
  entries: LogEntry[]
  total: number
}

// Paginated read for the dedicated Logs page. Reads the file once per
// call (unavoidable without an actual index/database, which this
// app's scale doesn't warrant), but only JSON.parse's the lines the
// requested page actually needs instead of every entry in the file -
// keeps the per-request cost proportional to pageSize, not total log
// size, as the file grows over a long-running install.
export function getLogPage(page: number, pageSize: number, path: string): LogPage {
  if (!existsSync(path)) return { entries: [], total: 0 }

  let text: string
  try {
    text = readFileSync(path, 'utf-8')
  } catch {
    return { entries: [], total: 0 }
  }

  const lines = text.split('\n').filter((line) => line.trim() !== '')
  // File is append-only oldest -> newest; most-recent-first for
  // display means reversing the line order, not the parsed entries.
  lines.reverse()

  const start = page * pageSize
  const pageLines = lines.slice(start, start + pageSize)

  const entries: LogEntry[] = []
  for (const line of pageLines) {
    try {
      entries.push(JSON.parse(line) as LogEntry)
    } catch {
      // Skip a malformed line rather than fail the whole page.
    }
  }

  return { entries, total: lines.length }
}
