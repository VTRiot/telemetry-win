import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface Props {
  connId: string
  pjPath: string
}

// xterm.js × ssh2 shell channel を IPC で繋ぐ React コンポーネント。
// マウント時に PTY セッションを開き、アンマウント時に閉じる。
// Pattern A 確定（Phase A spike A-2 で実証）。node-pty は不採用。
export function PtyPane({ connId, pjPath }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [status, setStatus] = useState<'opening' | 'ready' | 'closed' | 'error'>('opening')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
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
  }, [connId, pjPath])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--statusbar)] px-4 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[var(--muted-foreground)]">{pjPath}</span>
        </div>
        <PtyStatusBadge status={status} errorMsg={errorMsg} />
      </div>
      <div className="flex-1 xterm-container" ref={containerRef} />
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
