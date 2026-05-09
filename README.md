# CCPIT-R (Telemetry)

> **Remote operator for Claude Code on macOS — driven from Windows over Tailscale + SSH.**
> 開発コードネーム: **Telemetry**（F1/MotoGP のテレメトリーシステム由来）

[![Phase](https://img.shields.io/badge/Phase-1%20%2F%20v1.0.0-d96bc4)](#) [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-d96bc4)](#) [![Target](https://img.shields.io/badge/Target%20OS-macOS-d96bc4)](#)

---

## What is this?

CCPIT-R は、Windows 上で動く Electron + React + TypeScript 製の GUI アプリ。Tailscale + SSH 経由で macOS リモートホストの `~/.claude/` を操作し、Claude Code をリモートで起動・対話する。

**痛点**: Mac の Claude Code を使うために毎回 SSH 接続 → cd → claude を打つ／ターミナル多重起動で迷子になる／PJ 切替がぎこちない。

**解決**: PJ 一覧（左ペイン）→ ワンクリックで `cd && claude`（右ペイン内蔵 PTY）。

CCPIT 本体（[CCPIT for Windows](https://github.com/VTRiot/ccpit-win)）の兄弟アプリ。CCPIT ファミリ第二弾。

---

## Features (v1.0.0)

- ✅ SSH 接続管理（Tailscale 経由、SSH 鍵認証、Test Connection）
- ✅ リモート PJ 一覧（`~/.claude/projects/` を SFTP で列挙）
- ✅ ワンクリック起動（`cd <pj> && claude` を SSH shell channel で実行）
- ✅ 内蔵 PTY ペイン（xterm.js + ssh2 shell channel、ANSI 完全サポート、リサイズ追従、UTF-8 日本語入出力）
- ✅ NSIS インストーラ（`CCPIT-R-Setup-1.0.0.exe`）

将来予定（roadmap）:

- v1.1.0: Health Check / MCP 編集 UI
- v1.2.0: Recovery Kit / Setup Wizard
- v1.3.0: Telemetry-MCPM（Macau Protocol Goldenツリーデプロイ）
- v2.x: Linux 対応（ASAMA Protocol）

---

## Install

### 1. Tailscale をセットアップする

[Tailscale](https://tailscale.com/) を **Windows と Mac の両方**にインストールし、同じアカウントでログインする。

```powershell
# Windows
winget install --id Tailscale.Tailscale -e
```

```bash
# macOS
brew install --cask tailscale
```

`tailscale status` で両ホストが見えること、ホスト名（例: `hrd-mac01`）が確定していることを確認する。

### 2. SSH 鍵を設定する

Windows 側で SSH 鍵を生成し、公開鍵を Mac に登録する。

```powershell
# Windows PowerShell
ssh-keygen -t ed25519 -f $HOME\.ssh\id_ed25519 -N ""

# 公開鍵を Mac に転送（Tailscale ホスト名 hrd-mac01 を使う例）
ssh-copy-id -i $HOME\.ssh\id_ed25519.pub raio@hrd-mac01
```

```bash
# Mac 側で sshd が public key 認証を許可していることを確認
sudo sed -i.bak 's/^#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo launchctl kickstart -k system/com.openssh.sshd  # （必要時のみ）
```

### 3. Mac に Claude Code (`claude` CLI) がインストール済みであること

```bash
# Mac 側で確認
which claude   # /opt/homebrew/bin/claude などが返ること
claude --version
```

未インストールなら [claude-code GitHub Releases](https://github.com/anthropics/claude-code) から取得。

### 4. CCPIT-R をインストールする

[GitHub Releases](https://github.com/VTRiot/telemetry-win/releases/latest) から `CCPIT-R-Setup-1.0.0.exe` をダウンロードして実行。

> ⚠ Phase 1 (v1.0.0) の `.exe` は **未署名** です（codesign 証明書未付与）。SmartScreen 警告が出ることがあります。「詳細情報 → 実行」で進んでください。署名は v1.1 以降の TODO。

---

## Usage

1. CCPIT-R を起動
2. 初回ウィザードで Mac 接続情報を入力
   - 接続名: `mbp-m5max` 等の任意の識別子
   - ホスト名: Tailscale ホスト名（例: `hrd-mac01`）
   - ユーザー名: Mac 側の SSH ユーザー（例: `raio`）
   - SSH 鍵パス: `~/.ssh/id_ed25519` 等
3. 「接続テスト」で疎通を確認 → 「保存して開始」
4. 左ペインに PJ 一覧（Mac 側 `~/.claude/projects/` 由来）
5. PJ をクリック → 右ペインで CC が起動、対話開始

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Windows (CCPIT-R)                              │
│                                                 │
│   Renderer (React + xterm.js)                   │
│        │                                        │
│        ▼ IPC                                    │
│   Main (Node.js)                                │
│        │                                        │
│        ▼ ssh2 (pure JS, Tailscale 経由)         │
└────────┼────────────────────────────────────────┘
         │ SSH
         ▼
┌─────────────────────────────────────────────────┐
│  macOS                                          │
│                                                 │
│   sshd → zsh interactive shell                  │
│             ├─ SFTP: ~/.claude/projects/        │
│             └─ exec: cd <pj> && claude          │
└─────────────────────────────────────────────────┘
```

詳細は [docs/architecture.md](docs/architecture.md)（Phase 2 で追加予定）。

---

## Development

### Stack

- Electron 39 + React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS v4
- SSH: `ssh2` (pure JS、PTY allocation 内蔵)
- Terminal: `@xterm/xterm` + `@xterm/addon-fit`
- Persist: `electron-store` (非機密) + `keytar` (Windows Credential Manager 連携)

### Build from source

```bash
git clone https://github.com/VTRiot/telemetry-win.git
cd telemetry-win
npm install
npm run dev          # 開発起動
npm run typecheck    # 型検査
npm run lint         # ESLint
npm test             # Vitest
npm run build:win    # NSIS インストーラ生成 (dist/CCPIT-R-Setup-1.0.0.exe)
```

---

## Repository structure

```
.
├── src/
│   ├── main/        Electron main プロセス（IPC, SSH services）
│   ├── preload/     contextBridge API (renderer ↔ main)
│   ├── renderer/    React UI (xterm.js, shadcn-style components)
│   └── shared/      main / renderer 共通の型定義
├── build/           ビルド資源（icon.ico）
├── resources/       ランタイム資源（icon.png）
├── electron-builder.yml   NSIS 設定
├── electron.vite.config.ts
└── README.md
```

---

## License

MIT (TBD)

## Author

[VTRiot](https://github.com/VTRiot) — CCPIT ファミリの一部として開発。

---

## English summary

CCPIT-R is a Windows GUI for operating Claude Code on a remote macOS host via Tailscale + SSH. It lets you list `~/.claude/projects/` on the Mac, click a project to launch `cd <pj> && claude` in an embedded PTY pane (xterm.js powered), and interact with Claude Code without juggling terminals. Sibling product to CCPIT (Win) for local Claude Code management.
