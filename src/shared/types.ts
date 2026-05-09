// preload と renderer の両方から import される共有型。
// main プロセスからも利用可。

export interface Connection {
  id: string
  name: string
  os: 'macos' | 'linux'
  host: string
  port: number
  username: string
  privateKeyPath: string
  passphraseRequired: boolean
  createdAt: string
  lastConnectedAt?: string
}

export type NewConnection = Omit<Connection, 'id' | 'createdAt' | 'lastConnectedAt'>

export interface RemoteProject {
  slug: string
  pjPath: string
  displayName: string
  lastModifiedMs: number
}

export interface TestConnectionResult {
  ok: boolean
  error?: string
  remote?: {
    uname: string
    claudeVersion?: string
    homeDir?: string
  }
}

export interface OpenPtyArgs {
  connId: string
  pjPath: string
  rows?: number
  cols?: number
}

export type ConnectionOpenResult = { ok: true } | { ok: false; error: string }
