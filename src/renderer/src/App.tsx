import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Connection, RemoteProject } from '@shared/types'
import { ConnectionWizard } from './pages/ConnectionWizard'
import { ProjectsLayout } from './pages/ProjectsLayout'
import { Brand } from './components/Brand'

export default function App(): JSX.Element {
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [activeConnId, setActiveConnId] = useState<string | null>(null)
  const [projects, setProjects] = useState<RemoteProject[]>([])
  const [activePjPath, setActivePjPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>('?')

  useEffect(() => {
    void window.api.getAppVersion().then(setAppVersion)
    void window.api.connectionList().then(setConnections)
  }, [])

  const handleWizardComplete = async (conn: Connection): Promise<void> => {
    setConnections((prev) => [...(prev ?? []), conn])
    await openConnection(conn.id)
  }

  const openConnection = async (connId: string): Promise<void> => {
    setError(null)
    const result = await window.api.connectionOpen(connId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setActiveConnId(connId)
    try {
      const list = await window.api.projectList(connId)
      setProjects(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSelectProject = (pj: RemoteProject): void => {
    setActivePjPath(pj.pjPath)
  }

  const handleDisconnect = async (): Promise<void> => {
    if (activeConnId) {
      await window.api.connectionClose(activeConnId)
    }
    setActiveConnId(null)
    setProjects([])
    setActivePjPath(null)
  }

  // 起動直後: connection list 取得待ち
  if (connections === null) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)]">
        <div className="text-[var(--muted-foreground)]">Loading…</div>
      </div>
    )
  }

  // 接続なし → ウィザード
  if (connections.length === 0) {
    return (
      <div className="flex h-full flex-col bg-[var(--background)]">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <Brand version={appVersion} />
        </header>
        <main className="flex-1 overflow-auto">
          <ConnectionWizard onComplete={handleWizardComplete} />
        </main>
      </div>
    )
  }

  // 接続あり、未接続状態 or 接続済み
  const activeConn = connections.find((c) => c.id === activeConnId) ?? null

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--statusbar)] px-6 py-2 text-sm">
        <Brand version={appVersion} />
        <div className="flex items-center gap-3">
          {activeConn ? (
            <>
              <ConnectionBadge conn={activeConn} />
              <button
                onClick={handleDisconnect}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--accent)]"
              >
                切断
              </button>
            </>
          ) : (
            <ConnectSelector connections={connections} onSelect={openConnection} />
          )}
        </div>
      </header>
      {error && (
        <div className="border-b border-[var(--destructive)] bg-[var(--destructive)]/10 px-6 py-2 text-sm text-[var(--destructive)]">
          ⚠ {error}
        </div>
      )}
      <main className="flex-1 overflow-hidden">
        {activeConn ? (
          <ProjectsLayout
            connection={activeConn}
            projects={projects}
            activePjPath={activePjPath}
            onSelectProject={handleSelectProject}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
            上のセレクタから接続を開始してください。
          </div>
        )}
      </main>
    </div>
  )
}

function ConnectionBadge({ conn }: { conn: Connection }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--magenta)]/15 px-3 py-1 text-xs font-medium text-[var(--magenta)] ring-1 ring-[var(--magenta)]/40">
      <span className="size-2 rounded-full bg-[var(--magenta)]" />
      {conn.name} <span className="text-[var(--muted-foreground)]">({conn.host})</span>
    </span>
  )
}

function ConnectSelector({
  connections,
  onSelect
}: {
  connections: Connection[]
  onSelect: (id: string) => void
}): JSX.Element {
  if (connections.length === 1) {
    return (
      <button
        onClick={() => onSelect(connections[0].id)}
        className="rounded bg-[var(--magenta)] px-3 py-1 text-xs font-medium text-[var(--magenta-fg)] hover:opacity-90"
      >
        接続: {connections[0].name}
      </button>
    )
  }
  return (
    <select
      onChange={(e) => onSelect(e.target.value)}
      defaultValue=""
      className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
    >
      <option value="" disabled>
        接続を選択…
      </option>
      {connections.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.host})
        </option>
      ))}
    </select>
  )
}
