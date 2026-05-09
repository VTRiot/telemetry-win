import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
import {
  Connection,
  NewConnection,
  addConnection,
  getConnection,
  listConnections,
  removeConnection,
  touchLastConnected,
  updateConnection
} from './services/connectionStore'
import { connect, closeClient, testConnection } from './services/sshClient'
import { listRemoteProjects, RemoteProject } from './services/projectList'
import { closePty, openPty, resizePty, writePty } from './services/ptySession'

export function registerIpcHandlers(): void {
  // ---- Connections ----
  ipcMain.handle('connection:list', (): Connection[] => listConnections())

  ipcMain.handle('connection:add', (_evt, input: NewConnection): Connection => addConnection(input))

  ipcMain.handle(
    'connection:update',
    (_evt, id: string, patch: Partial<Connection>): Connection => updateConnection(id, patch)
  )

  ipcMain.handle('connection:remove', (_evt, id: string): void => {
    closeClient(id)
    removeConnection(id)
  })

  ipcMain.handle('connection:test', async (_evt, conn: Omit<Connection, 'id' | 'createdAt'>) => {
    return testConnection(conn)
  })

  ipcMain.handle(
    'connection:open',
    async (_evt, id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const conn = getConnection(id)
      if (!conn) {
        return { ok: false, error: `Connection not found: ${id}` }
      }
      try {
        await connect(conn)
        touchLastConnected(id)
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle('connection:close', (_evt, id: string): void => {
    closeClient(id)
  })

  // ---- Projects ----
  ipcMain.handle(
    'project:list',
    async (_evt, connId: string): Promise<RemoteProject[]> => listRemoteProjects(connId)
  )

  // ---- PTY ----
  ipcMain.handle(
    'pty:open',
    async (
      evt,
      args: { connId: string; pjPath: string; rows?: number; cols?: number }
    ): Promise<{ sessionId: string }> => {
      const sender = evt.sender
      return openPty(sender, args)
    }
  )

  ipcMain.handle('pty:write', (_evt, sessionId: string, data: string): void => {
    writePty(sessionId, data)
  })

  ipcMain.handle('pty:resize', (_evt, sessionId: string, rows: number, cols: number): void => {
    resizePty(sessionId, rows, cols)
  })

  ipcMain.handle('pty:close', (_evt, sessionId: string): void => {
    closePty(sessionId)
  })

  // ---- App ----
  ipcMain.handle('app:getVersion', (): string => app.getVersion())

  ipcMain.handle('shell:openExternal', async (_evt, url: string): Promise<void> => {
    await shell.openExternal(url)
  })

  // ---- Dialog ----
  ipcMain.handle('dialog:selectKeyFile', async (evt): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: 'SSH 鍵ファイルを選択',
      properties: ['openFile', 'showHiddenFiles'],
      filters: [{ name: 'All files', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
