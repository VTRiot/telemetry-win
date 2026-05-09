import { useState } from 'react'
import type { JSX } from 'react'
import type { Connection, NewConnection, TestConnectionResult } from '@shared/types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

interface Props {
  onComplete: (conn: Connection) => void
}

const DEFAULT_PORT = 22
const DEFAULT_KEY_HINT = '~/.ssh/id_ed25519'

export function ConnectionWizard({ onComplete }: Props): JSX.Element {
  const [name, setName] = useState('mbp-m5max')
  const [host, setHost] = useState('hrd-mac01')
  const [username, setUsername] = useState('raio')
  const [port, setPort] = useState(DEFAULT_PORT)
  const [keyPath, setKeyPath] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSelectKey = async (): Promise<void> => {
    const picked = await window.api.selectKeyFile()
    if (picked) setKeyPath(picked)
  }

  const buildConn = (): NewConnection => ({
    name: name.trim() || host.trim(),
    os: 'macos',
    host: host.trim(),
    port,
    username: username.trim(),
    privateKeyPath: keyPath.trim(),
    passphraseRequired: false
  })

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.connectionTest(buildConn())
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const created = await window.api.connectionAdd(buildConn())
      onComplete(created)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = name.trim() && host.trim() && username.trim() && keyPath.trim()
  const canSave = canSubmit && testResult?.ok === true

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <span className="cc-emblem">Welcome to CCPIT-R</span>
          </CardTitle>
          <CardDescription>
            Tailscale + SSH 経由で Mac リモートホストの Claude Code
            を遠隔操作するための初回セットアップ。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">接続名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: mbp-m5max"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="host">ホスト名 (Tailscale)</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="例: hrd-mac01"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">ポート</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || DEFAULT_PORT)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">SSH ユーザー名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例: raio"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="keyPath">SSH 秘密鍵パス</Label>
            <div className="flex gap-2">
              <Input
                id="keyPath"
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder={DEFAULT_KEY_HINT}
              />
              <Button variant="outline" onClick={handleSelectKey}>
                選択…
              </Button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              パスフレーズ付き鍵は v1.1 以降で対応予定。Phase 1 は平文鍵のみ。
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleTest} disabled={!canSubmit || testing}>
              {testing ? '接続テスト中…' : '接続テスト'}
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? '保存中…' : '保存して開始'}
            </Button>
          </div>

          {testResult && (
            <div
              className={
                testResult.ok
                  ? 'rounded border border-[var(--magenta)] bg-[var(--magenta)]/10 p-3 text-sm'
                  : 'rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]'
              }
            >
              {testResult.ok ? (
                <>
                  <p className="font-semibold text-[var(--magenta)]">✅ 接続成功</p>
                  {testResult.remote && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-[var(--foreground)]">
                      <li>uname: {testResult.remote.uname}</li>
                      <li>home: {testResult.remote.homeDir}</li>
                      <li>
                        claude:{' '}
                        {testResult.remote.claudeVersion ??
                          '(未検出 — リモートに claude をインストール要)'}
                      </li>
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="font-semibold">❌ 接続失敗</p>
                  <p className="mt-1 text-xs">{testResult.error}</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
