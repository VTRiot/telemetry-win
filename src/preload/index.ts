import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Connection 型は preload と renderer の両方で使うため、最小定義をここに置き、
// renderer からは `window.api` 越しに型推論で参照する（dts は preload/index.d.ts に定義）。

const api = {
  // Connections
  connectionList: () => ipcRenderer.invoke('connection:list'),
  connectionAdd: (input: unknown) => ipcRenderer.invoke('connection:add', input),
  connectionUpdate: (id: string, patch: unknown) =>
    ipcRenderer.invoke('connection:update', id, patch),
  connectionRemove: (id: string) => ipcRenderer.invoke('connection:remove', id),
  connectionTest: (conn: unknown) => ipcRenderer.invoke('connection:test', conn),
  connectionOpen: (id: string) => ipcRenderer.invoke('connection:open', id),
  connectionClose: (id: string) => ipcRenderer.invoke('connection:close', id),

  // Projects
  projectList: (connId: string) => ipcRenderer.invoke('project:list', connId),

  // PTY
  ptyOpen: (args: { connId: string; pjPath: string; rows?: number; cols?: number }) =>
    ipcRenderer.invoke('pty:open', args),
  ptyWrite: (sessionId: string, data: string) => ipcRenderer.invoke('pty:write', sessionId, data),
  ptyResize: (sessionId: string, rows: number, cols: number) =>
    ipcRenderer.invoke('pty:resize', sessionId, rows, cols),
  ptyClose: (sessionId: string) => ipcRenderer.invoke('pty:close', sessionId),

  // PTY events (sessionId 単位の channel をリッスン)
  onPtyData: (sessionId: string, cb: (data: string) => void): (() => void) => {
    const channel = `pty:data:${sessionId}`
    const handler = (_evt: unknown, data: string): void => cb(data)
    ipcRenderer.on(channel, handler)
    return (): void => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
  onPtyClose: (sessionId: string, cb: () => void): (() => void) => {
    const channel = `pty:close:${sessionId}`
    const handler = (): void => cb()
    ipcRenderer.on(channel, handler)
    return (): void => {
      ipcRenderer.removeListener(channel, handler)
    }
  },

  // App
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  // Dialog
  selectKeyFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectKeyFile'),

  // Shell
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
