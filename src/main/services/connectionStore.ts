import Store from 'electron-store'
import { randomUUID } from 'node:crypto'
import { STORE_KEY_CONNECTIONS } from './constants'
import type { Connection, NewConnection } from '../../shared/types'

// shared/types.ts の Connection 型を再 export（既存 import を維持）
export type { Connection, NewConnection }

// 接続情報の永続化。機密値（パスフレーズ）は Phase 2 以降に keytar で別管理。
// 非機密値（ホスト名、ユーザー名、鍵パス）のみ electron-store に書く。

interface StoreSchema {
  [STORE_KEY_CONNECTIONS]: Connection[]
}

let store: Store<StoreSchema> | null = null

function getStore(): Store<StoreSchema> {
  if (!store) {
    store = new Store<StoreSchema>({
      name: 'telemetry-config',
      defaults: { [STORE_KEY_CONNECTIONS]: [] }
    })
  }
  return store
}

export function listConnections(): Connection[] {
  return getStore().get(STORE_KEY_CONNECTIONS, [])
}

export function getConnection(id: string): Connection | undefined {
  return listConnections().find((c) => c.id === id)
}

export function addConnection(input: NewConnection): Connection {
  const connections = listConnections()
  const conn: Connection = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  }
  getStore().set(STORE_KEY_CONNECTIONS, [...connections, conn])
  return conn
}

export function updateConnection(id: string, patch: Partial<Connection>): Connection {
  const connections = listConnections()
  const idx = connections.findIndex((c) => c.id === id)
  if (idx === -1) {
    throw new Error(`Connection not found: ${id}`)
  }
  const updated: Connection = { ...connections[idx], ...patch, id: connections[idx].id }
  const next = [...connections]
  next[idx] = updated
  getStore().set(STORE_KEY_CONNECTIONS, next)
  return updated
}

export function removeConnection(id: string): void {
  const connections = listConnections()
  getStore().set(
    STORE_KEY_CONNECTIONS,
    connections.filter((c) => c.id !== id)
  )
}

export function touchLastConnected(id: string): void {
  const conn = getConnection(id)
  if (!conn) return
  updateConnection(id, { lastConnectedAt: new Date().toISOString() })
}
