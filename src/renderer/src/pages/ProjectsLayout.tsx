import type { JSX } from 'react'
import type { Connection, RemoteProject } from '@shared/types'
import { PtyPane } from '../components/PtyPane'

interface Props {
  connection: Connection
  projects: RemoteProject[]
  activePjPath: string | null
  onSelectProject: (pj: RemoteProject) => void
}

export function ProjectsLayout({
  connection,
  projects,
  activePjPath,
  onSelectProject
}: Props): JSX.Element {
  return (
    <div className="flex h-full">
      {/* 左ペイン: PJ 一覧 */}
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
        <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          Projects ({projects.length})
        </div>
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
            ~/.claude/projects/ にディレクトリがありません。
          </div>
        ) : (
          <ul>
            {projects.map((pj) => (
              <li key={pj.slug}>
                <button
                  onClick={() => onSelectProject(pj)}
                  className={
                    'w-full px-4 py-2 text-left text-sm transition-colors ' +
                    (pj.pjPath === activePjPath
                      ? 'bg-[var(--sidebar-active)] text-[var(--magenta)]'
                      : 'hover:bg-[var(--sidebar-hover)]')
                  }
                  title={pj.pjPath}
                >
                  <div className="font-medium truncate">{pj.displayName}</div>
                  <div className="truncate text-[10px] text-[var(--muted-foreground)]">
                    {pj.pjPath}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 右ペイン: PTY ペイン */}
      <section className="flex-1 overflow-hidden">
        {activePjPath ? (
          <PtyPane
            key={`${connection.id}:${activePjPath}`}
            connId={connection.id}
            pjPath={activePjPath}
            displayName={
              projects.find((pj) => pj.pjPath === activePjPath)?.displayName ?? activePjPath
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
            左ペインから PJ を選択すると、リモート CC が起動します。
          </div>
        )}
      </section>
    </div>
  )
}
