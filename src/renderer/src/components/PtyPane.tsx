import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface Props {
  connId: string
  pjPath: string
  displayName: string
}

// pjPath が絶対 POSIX パス（`/` 始まり）かどうか判定。
// v1.0.2 → v1.0.3 で readPjCwd の実機検証ギャップが発覚し、fallback 経路で
// pjPath = slug (`-Users-...`) になっていた。slug のままでは PTY 起動 cd が失敗する。
// renderer 側でも形状チェックして UI に明示する（silent failure 回避、
// debug-toolkit 型 7 多層防御の renderer 側）。
function isResolvedPjPath(pjPath: string): boolean {
  return pjPath.startsWith('/')
}

// xterm.js × ssh2 shell channel を IPC で繋ぐ React コンポーネント。
// マウント時に PTY セッションを開き、アンマウント時に閉じる。
// Pattern A 確定（Phase A spike A-2 で実証）。node-pty は不採用。
export function PtyPane({ connId, pjPath, displayName }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [status, setStatus] = useState<'opening' | 'ready' | 'closed' | 'error'>('opening')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const pathResolved = isResolvedPjPath(pjPath)

  useEffect(() => {
    if (!pathResolved) return
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontFamily: '"Cascadia Code", Menlo, Consolas, "Hiragino Sans", "MS Gothic", monospace',
      fontSize: 13,
      theme: {
        background: '#1a1518',
        foreground: '#e8dde3',
        cursor: '#d96bc4',
        black: '#1a1518',
        red: '#e85a7a',
        green: '#7ad99c',
        yellow: '#e8c97a',
        blue: '#7ab4e8',
        magenta: '#d96bc4',
        cyan: '#7ae8d6',
        white: '#e8dde3'
      },
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)

    // 初期サイズ調整 → PTY 起動
    requestAnimationFrame(() => {
      fit.fit()
      const { rows, cols } = term
      void window.api
        .ptyOpen({ connId, pjPath, rows, cols })
        .then(({ sessionId }) => {
          sessionIdRef.current = sessionId
          setStatus('ready')

          const offData = window.api.onPtyData(sessionId, (data) => {
            term.write(data)
          })
          const offClose = window.api.onPtyClose(sessionId, () => {
            setStatus('closed')
            offData()
            offClose()
          })

          term.onData((data) => {
            void window.api.ptyWrite(sessionId, data)
          })

          term.onResize(({ rows, cols }) => {
            void window.api.ptyResize(sessionId, rows, cols)
          })
        })
        .catch((e) => {
          setErrorMsg(e instanceof Error ? e.message : String(e))
          setStatus('error')
        })
    })

    termRef.current = term
    fitRef.current = fit

    const handleResize = (): void => {
      try {
        fit.fit()
      } catch {
        // 描画されていない場合は無視
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      const sid = sessionIdRef.current
      if (sid) {
        void window.api.ptyClose(sid)
      }
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [connId, pjPath, pathResolved])

  // pjPath が未解決 (slug 生のまま) の場合は PTY を開かず、エラーパネルを描画。
  // v1.0.0 §4-2 で発見した「slug → path 逆変換不能」問題の UI 側ガード。
  if (!pathResolved) {
    return <UnresolvedPathPanel pjPath={pjPath} displayName={displayName} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--statusbar)] px-4 py-1.5 text-xs">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium text-[var(--foreground)] truncate">{displayName}</span>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)] truncate">
            {pjPath}
          </span>
        </div>
        <PtyStatusBadge status={status} errorMsg={errorMsg} />
      </div>
      <div className="flex-1 xterm-container" ref={containerRef} />
    </div>
  )
}

// pjPath 未解決時のエラーパネル。v1.0.0 §4-2 で発見した「slug → path 逆変換不能」
// 問題で、jsonl の cwd 取得失敗時に pjPath = slug (例: `-Users-raio--Prog-mbp-setup`)
// になる。v1.0.2 まではそのまま PTY に渡って `cd '-Users-...'` が失敗、
// claude が cwd=Home のまま起動するという致命バグ (silent failure) になっていた。
// v1.0.3 で UI に明示するパネルを追加（v1.0.1 BootErrorPanel と同パターン）。
function UnresolvedPathPanel({
  pjPath,
  displayName
}: {
  pjPath: string
  displayName: string
}): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--background)] p-8">
      <div className="max-w-2xl rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--destructive)]">
          ⚠ プロジェクトのパスを解決できませんでした
        </h2>
        <p className="mb-3 text-sm text-[var(--foreground)]">
          このプロジェクトの絶対パスが
          <code className="mx-1 rounded bg-[var(--card)] px-1 py-0.5 font-mono text-xs">
            ~/.claude/projects/{displayName}
          </code>
          配下のセッションログから取得できませんでした。CC を起動するとカレントディレクトリが
          想定外の場所になる可能性があるため、起動を見合わせています。
        </p>
        <p className="mb-3 text-sm text-[var(--muted-foreground)]">
          このプロジェクトでまだ Claude Code
          を一度も起動していないか、ログ形式が想定と異なる可能性があります。 一度ローカル (Mac)
          のターミナルで <code>cd &lt;pj&gt; &amp;&amp; claude</code>{' '}
          を実行してから再度お試しください。
        </p>
        <pre className="max-h-32 overflow-auto rounded bg-[var(--card)] p-3 text-xs text-[var(--muted-foreground)]">
          slug: {pjPath}
        </pre>
      </div>
    </div>
  )
}

function PtyStatusBadge({
  status,
  errorMsg
}: {
  status: 'opening' | 'ready' | 'closed' | 'error'
  errorMsg: string | null
}): JSX.Element {
  if (status === 'opening') {
    return <span className="text-[var(--muted-foreground)]">PTY 起動中…</span>
  }
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--magenta)]">
        <span className="size-1.5 rounded-full bg-[var(--magenta)] animate-pulse" />
        接続中
      </span>
    )
  }
  if (status === 'closed') {
    return <span className="text-[var(--muted-foreground)]">セッション終了</span>
  }
  return (
    <span className="text-[var(--destructive)]" title={errorMsg ?? ''}>
      エラー: {errorMsg ?? 'unknown'}
    </span>
  )
}
