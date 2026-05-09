import { ClientChannel } from 'ssh2'
import { randomUUID } from 'node:crypto'
import { WebContents } from 'electron'
import { getActiveClient } from './sshClient'
import {
  CLAUDE_LAUNCH_COMMAND,
  PTY_DEFAULT_COLS,
  PTY_DEFAULT_ENV,
  PTY_DEFAULT_ROWS,
  PTY_DEFAULT_TERM
} from './constants'

interface PtySessionRecord {
  sessionId: string
  connId: string
  pjPath: string
  channel: ClientChannel
  webContents: WebContents
}

const sessions = new Map<string, PtySessionRecord>()

export interface OpenPtyArgs {
  connId: string
  pjPath: string
  rows?: number
  cols?: number
}

export async function openPty(
  webContents: WebContents,
  args: OpenPtyArgs
): Promise<{ sessionId: string }> {
  const client = getActiveClient(args.connId)
  if (!client) {
    throw new Error(`No active SSH connection: ${args.connId}`)
  }

  const rows = args.rows ?? PTY_DEFAULT_ROWS
  const cols = args.cols ?? PTY_DEFAULT_COLS

  const channel = await new Promise<ClientChannel>((resolve, reject) => {
    client.shell(
      {
        term: PTY_DEFAULT_TERM,
        rows,
        cols
      },
      { env: PTY_DEFAULT_ENV },
      (err, ch) => {
        if (err) return reject(err)
        resolve(ch)
      }
    )
  })

  const sessionId = randomUUID()
  const record: PtySessionRecord = {
    sessionId,
    connId: args.connId,
    pjPath: args.pjPath,
    channel,
    webContents
  }
  sessions.set(sessionId, record)

  // stream → renderer
  channel.on('data', (data: Buffer) => {
    if (!webContents.isDestroyed()) {
      webContents.send(`pty:data:${sessionId}`, data.toString('utf8'))
    }
  })

  channel.on('close', () => {
    if (!webContents.isDestroyed()) {
      webContents.send(`pty:close:${sessionId}`, null)
    }
    sessions.delete(sessionId)
  })

  // 起動コマンド送信（cd → exec zsh -i）。zsh -i 起動後 claude を打つのは
  // らいおの判断（Phase 1 はワンクリック起動 = ディレクトリ移動 + interactive shell まで）。
  // らいおが claude を打って起動する経路と、自動で claude を打つ経路の両方を提供する。
  // V1.0.0 ではディレクトリ移動 + claude 起動の auto fire をデフォルトとする。
  channel.write(CLAUDE_LAUNCH_COMMAND(args.pjPath) + '\n')

  return { sessionId }
}

export function writePty(sessionId: string, data: string): void {
  const record = sessions.get(sessionId)
  if (!record) return
  record.channel.write(data)
}

export function resizePty(sessionId: string, rows: number, cols: number): void {
  const record = sessions.get(sessionId)
  if (!record) return
  record.channel.setWindow(rows, cols, 0, 0)
}

export function closePty(sessionId: string): void {
  const record = sessions.get(sessionId)
  if (!record) return
  try {
    record.channel.end()
  } catch {
    // 既に切断済の場合は無視
  }
  sessions.delete(sessionId)
}

export function closeAllPty(): void {
  for (const id of Array.from(sessions.keys())) {
    closePty(id)
  }
}
