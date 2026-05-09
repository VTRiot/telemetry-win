import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Connection,
  NewConnection,
  RemoteProject,
  TestConnectionResult,
  ConnectionOpenResult,
  OpenPtyArgs
} from '../shared/types'

export type {
  Connection,
  NewConnection,
  RemoteProject,
  TestConnectionResult,
  ConnectionOpenResult,
  OpenPtyArgs
}

export interface TelemetryApi {
  connectionList: () => Promise<Connection[]>
  connectionAdd: (input: NewConnection) => Promise<Connection>
  connectionUpdate: (id: string, patch: Partial<Connection>) => Promise<Connection>
  connectionRemove: (id: string) => Promise<void>
  connectionTest: (conn: NewConnection) => Promise<TestConnectionResult>
  connectionOpen: (id: string) => Promise<ConnectionOpenResult>
  connectionClose: (id: string) => Promise<void>

  projectList: (connId: string) => Promise<RemoteProject[]>

  ptyOpen: (args: OpenPtyArgs) => Promise<{ sessionId: string }>
  ptyWrite: (sessionId: string, data: string) => Promise<void>
  ptyResize: (sessionId: string, rows: number, cols: number) => Promise<void>
  ptyClose: (sessionId: string) => Promise<void>
  onPtyData: (sessionId: string, cb: (data: string) => void) => () => void
  onPtyClose: (sessionId: string, cb: () => void) => () => void

  getAppVersion: () => Promise<string>
  selectKeyFile: () => Promise<string | null>
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TelemetryApi
  }
}
