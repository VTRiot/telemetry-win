// CCPIT-R main プロセス側定数
// マジックナンバー禁止規範に従い、SSH/PTY/UI 等の値を一元管理する

export const SSH_DEFAULT_PORT = 22
export const SSH_READY_TIMEOUT_MS = 10_000
export const SSH_KEEPALIVE_INTERVAL_MS = 30_000

// PTY のデフォルト値。要件 §6-3「ANSI エスケープ完全サポート」「リサイズ追従」整合。
// term は xterm-256color 固定（UI から変更不可、ELADIO r4 §8 文字化け根治の Pattern A 適用）。
export const PTY_DEFAULT_TERM = 'xterm-256color'
export const PTY_DEFAULT_ROWS = 30
export const PTY_DEFAULT_COLS = 100

// CC のリモート PTY で UTF-8 を強制するため env を注入。
// MBP 側 OpenSSH の AcceptEnv LANG が既設定の前提。
export const PTY_DEFAULT_ENV: Record<string, string> = {
  LANG: 'ja_JP.UTF-8',
  LC_ALL: 'ja_JP.UTF-8',
  TERM: PTY_DEFAULT_TERM
}

// CC の起動コマンド。ssh2 client.shell() は interactive zsh を立ち上げ、
// ~/.zshrc が読まれて PATH に /opt/homebrew/bin（A-1-5 で実測）が入る。
// 単純に `cd <pj> && claude` で起動する。
// シングルクォートのエスケープは POSIX 流儀（'\'' で閉じて `'` を出して再開）。
//
// v1.0.3 で絶対パス guard 追加 (debug-toolkit 型 7 多層防御):
// pjPath が `/` 始まりでない場合は throw。これは projectList.ts の
// fallback 経路で slug (`-Users-...`) がそのまま渡る v1.0.2 致命バグの保険。
// 主因は readPjCwd の line スキャン化で潰すが、IPC handler で contract
// 違反を顕在化させて silent failure を防ぐ。
export const CLAUDE_LAUNCH_COMMAND = (pjPath: string): string => {
  if (!pjPath.startsWith('/')) {
    throw new Error(
      `CLAUDE_LAUNCH_COMMAND: pjPath must be an absolute POSIX path (starts with '/'), got: ${JSON.stringify(pjPath)}`
    )
  }
  const escaped = pjPath.replace(/'/g, `'\\''`)
  return `cd '${escaped}' && claude`
}

// リモート ~/.claude/projects/ の場所。Mac/Linux 共通で home 直下固定。
export const REMOTE_CLAUDE_PROJECTS_DIR = '.claude/projects'

// keytar service 名（OS Credential Manager 上の識別子）
export const KEYTAR_SERVICE_NAME = 'CCPIT-R'

// electron-store の key
export const STORE_KEY_CONNECTIONS = 'connections'

// Phase 1 制約: 接続数 1, multi-PTY 不可
export const MAX_CONNECTIONS_PHASE1 = 1
export const MAX_CONCURRENT_PTY_SESSIONS = 1

// Splash window 設定 (v1.0.2 で追加)。既知の splash 仕組みを最小抽出、appConfig 依存除去。
// 540×234 はソース画像 1905×825 の比率 (≈ 2.31:1) を保持した縮小値。
export const SPLASH_WIDTH = 540
export const SPLASH_HEIGHT = 234
// 最低表示時間。main の load が早く完了しても、この時間は splash を見せる
// （ロゴ視認性確保 + 起動感の演出）。Phase 2 で演出ロジック検討候補。
export const SPLASH_MIN_DURATION_MS = 1500
