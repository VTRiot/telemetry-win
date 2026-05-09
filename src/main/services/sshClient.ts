import { Client } from 'ssh2'
import { readFile } from 'node:fs/promises'
import { Connection } from './connectionStore'
import { SSH_KEEPALIVE_INTERVAL_MS, SSH_READY_TIMEOUT_MS } from './constants'

// connectionId → 生きている ssh2 Client。Phase 1 は接続数 1 想定だが、
// 将来の multi-connection に備えて Map で管理。
const activeClients = new Map<string, Client>()

export class SshError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'SshError'
  }
}

export async function connect(conn: Connection): Promise<Client> {
  // 既存クライアントがあれば close（重複接続防止）
  closeClient(conn.id)

  const privateKey = await readFile(conn.privateKeyPath)
  const client = new Client()

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => {
      client.removeListener('ready', onReady)
      reject(new SshError(`SSH connect failed: ${err.message}`, err))
    }
    const onReady = (): void => {
      client.removeListener('error', onError)
      resolve()
    }
    client.once('ready', onReady)
    client.once('error', onError)

    client.connect({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      privateKey,
      readyTimeout: SSH_READY_TIMEOUT_MS,
      keepaliveInterval: SSH_KEEPALIVE_INTERVAL_MS
    })
  })

  // 切断時の自動クリーンアップ
  client.on('close', () => {
    activeClients.delete(conn.id)
  })

  activeClients.set(conn.id, client)
  return client
}

export function getActiveClient(connId: string): Client | undefined {
  return activeClients.get(connId)
}

export function closeClient(connId: string): void {
  const client = activeClients.get(connId)
  if (client) {
    try {
      client.end()
    } catch {
      // 既に切断済の場合は無視
    }
    activeClients.delete(connId)
  }
}

export function closeAllClients(): void {
  for (const id of activeClients.keys()) {
    closeClient(id)
  }
}

// 接続テスト。connect → uname / claude --version を確認 → 切断。
// Connection が store に未保存でも動作する（Test Connection ボタン用途）。
export interface TestConnectionResult {
  ok: boolean
  error?: string
  remote?: {
    uname: string
    claudeVersion?: string
    homeDir?: string
  }
}

export async function testConnection(
  conn: Omit<Connection, 'id' | 'createdAt'>
): Promise<TestConnectionResult> {
  const tempId = `__test__${Date.now()}`
  try {
    const fullConn: Connection = {
      ...conn,
      id: tempId,
      createdAt: new Date().toISOString()
    }
    const client = await connect(fullConn)
    const uname = await execSimple(client, 'uname -a')
    let claudeVersion: string | undefined
    try {
      claudeVersion = (await execSimple(client, 'zsh -lc "claude --version"')).trim()
    } catch {
      // claude が見つからない場合は undefined（ユーザーに「セットアップ未完」を伝える）
    }
    const homeDir = (await execSimple(client, 'echo $HOME')).trim()
    closeClient(tempId)
    return { ok: true, remote: { uname: uname.trim(), claudeVersion, homeDir } }
  } catch (err) {
    closeClient(tempId)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

function execSimple(client: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err)
      let stdout = ''
      let stderr = ''
      stream.on('data', (d: Buffer) => (stdout += d.toString('utf8')))
      stream.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')))
      stream.on('close', (code: number | null) => {
        if (code === 0 || code === null) {
          resolve(stdout)
        } else {
          reject(new SshError(`exec failed (code=${code}): ${stderr || stdout}`))
        }
      })
    })
  })
}
