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
  const [bootError, setBootError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>('?')

  useEffect(() => {
    // version 取得失敗は致命的でないため、表示は '?' のままで継続
    void window.api
      .getAppVersion()
      .then(setAppVersion)
      .catch(() => undefined)

    // connectionList の reject はサイレント固着の主因。
    // .catch() で UI に surface する（v1.0.0 → v1.0.1 改修、260510_1706 調査報告 §6 副次弱点）
    void window.api
      .connectionList()
      .then(setConnections)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        setBootError(msg)
        // Loading から脱出させ、ErrorPanel に分岐させる。
        // 注: connections === [] は「成功 0 件」と意味的に重複する設計トレードオフを承知の上で、
        // bootError !== null の分岐を上位に置くことで UI 表示は明確に分離される
        // （Phase 2 で state machine 整理候補、本修正のスコープ外）
        setConnections([])
      })
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

  // 起動時のブート失敗（IPC reject 等）。Loading… で固着させず、UI に surface する。
  if (bootError !== null) {
    return <BootErrorPanel message={bootError} onRetry={() => location.reload()} />
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

// 起動失敗時のエラー画面。Phase 1 は最小実装。
// Phase 2 でリッチ化（スタックトレース表示、ログを開く、診断モード等）。
function BootErrorPanel({
  message,
  onRetry
}: {
  message: string
  onRetry: () => void
}): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--background)] p-8">
      <div className="max-w-2xl rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--destructive)]">
          ⚠ 起動に失敗しました
        </h2>
        <p className="mb-3 text-sm text-[var(--foreground)]">
          接続情報の読み込み中にエラーが発生しました。アプリの再起動をお試しください。
        </p>
        <pre className="mb-4 max-h-40 overflow-auto rounded bg-[var(--card)] p-3 text-xs text-[var(--muted-foreground)]">
          {message}
        </pre>
        <button
          onClick={onRetry}
          className="rounded bg-[var(--magenta)] px-4 py-2 text-sm font-medium text-[var(--magenta-fg)] hover:opacity-90"
        >
          再試行（リロード）
        </button>
      </div>
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
