import { Client, FileEntry, SFTPWrapper } from 'ssh2'
import { constants as fsConstants } from 'node:fs'
import { getActiveClient } from './sshClient'
import { REMOTE_CLAUDE_PROJECTS_DIR } from './constants'
import type { RemoteProject } from '../../shared/types'

export type { RemoteProject }

// SFTP の `Attributes.mode` は POSIX file mode bits。S_IFDIR = 0o040000。
// FileEntry.attrs は Stats を継承していないため、isDirectory() は使えず mode bit 判定で代替する。
function isDirectoryEntry(entry: FileEntry): boolean {
  const S_IFMT = fsConstants.S_IFMT ?? 0o170000
  const S_IFDIR = fsConstants.S_IFDIR ?? 0o040000
  return (entry.attrs.mode & S_IFMT) === S_IFDIR
}

// CC の slug 命名規則（実機 hrd-mac01 で確認済、2026-05-10）:
//   path 区切り `/` → `-`
//   かつ ディレクトリ名内の `_` も `-` に置換される（情報損失）
// 例: `/Users/raio/_Prog/mbp-setup` → `-Users-raio--Prog-mbp-setup`
// → slug → path の逆変換は決定論的に不可能。
// 代替策: 各 slug 配下の最新 .jsonl ファイル（CC のセッションログ）の最初の record から
// `cwd` フィールドを取得して pjPath を確定する。
//
// fallback: jsonl 取得に失敗した場合、displayName は slug の最後の `-` から後ろ、
// pjPath は slug をそのまま使う（cd 失敗時は CC が echo + error で察知できる）。
export function deriveDisplayNameFromSlug(slug: string): string {
  if (!slug.startsWith('-')) return slug
  const idx = slug.lastIndexOf('-')
  return idx === -1 ? slug : slug.slice(idx + 1)
}

interface JsonlFirstRecord {
  cwd?: string
  type?: string
}

async function readPjCwd(sftp: SFTPWrapper, slugDir: string): Promise<string | undefined> {
  // slugDir 配下の .jsonl で最も atime が新しい 1 件の最初の行を読む
  const entries = await new Promise<FileEntry[]>((resolve, reject) => {
    sftp.readdir(slugDir, (err, list) => {
      if (err) return reject(err)
      resolve(list)
    })
  })
  const jsonls = entries
    .filter((e) => e.filename.endsWith('.jsonl'))
    .sort((a, b) => b.attrs.mtime - a.attrs.mtime)
  if (jsonls.length === 0) return undefined

  const targetPath = `${slugDir}/${jsonls[0].filename}`
  const text = await readFirstChunk(sftp, targetPath, 8192)
  const firstNewline = text.indexOf('\n')
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline)
  if (!firstLine.trim()) return undefined
  try {
    const record = JSON.parse(firstLine) as JsonlFirstRecord
    return record.cwd
  } catch {
    return undefined
  }
}

function readFirstChunk(sftp: SFTPWrapper, path: string, byteLimit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.open(path, 'r', (err, handle) => {
      if (err) return reject(err)
      const buf = Buffer.alloc(byteLimit)
      sftp.read(handle, buf, 0, byteLimit, 0, (err, bytesRead) => {
        sftp.close(handle, () => {
          if (err && (err as NodeJS.ErrnoException).code !== 'EOF') return reject(err)
          resolve(buf.slice(0, bytesRead ?? 0).toString('utf8'))
        })
      })
    })
  })
}

export async function listRemoteProjects(connId: string): Promise<RemoteProject[]> {
  const client = getActiveClient(connId)
  if (!client) {
    throw new Error(`No active SSH connection: ${connId}`)
  }

  const sftp = await openSftp(client)
  try {
    const entries = await new Promise<FileEntry[]>((resolve, reject) => {
      sftp.readdir(REMOTE_CLAUDE_PROJECTS_DIR, (err, list) => {
        if (err) return reject(err)
        resolve(list)
      })
    })

    const dirs = entries.filter(isDirectoryEntry)

    // 並列に各 slug の cwd を取得
    const enriched = await Promise.all(
      dirs.map(async (e): Promise<RemoteProject> => {
        const slug = e.filename
        const slugDir = `${REMOTE_CLAUDE_PROJECTS_DIR}/${slug}`
        let pjPath: string
        let displayName: string
        try {
          const cwd = await readPjCwd(sftp, slugDir)
          if (cwd) {
            pjPath = cwd
            const segments = cwd.split('/').filter(Boolean)
            displayName = segments.length ? segments[segments.length - 1] : cwd
          } else {
            pjPath = slug
            displayName = deriveDisplayNameFromSlug(slug)
          }
        } catch {
          pjPath = slug
          displayName = deriveDisplayNameFromSlug(slug)
        }
        return {
          slug,
          pjPath,
          displayName,
          lastModifiedMs: e.attrs.mtime * 1000
        }
      })
    )

    return enriched.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
  } finally {
    sftp.end()
  }
}

function openSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) return reject(err)
      resolve(sftp)
    })
  })
}
