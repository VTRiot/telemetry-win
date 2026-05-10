# Changelog

All notable changes to CCPIT-R (codename Telemetry) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] — 2026-05-10

### Fixed

- **起動時 `Loading…` で固着するバグを修正**
  - 原因: `electron-store@10.1.0` が ESM-only パッケージ。`externalizeDepsPlugin()` 経由の `require()` で CJS interop が壊れ、`new Store(...)` で `TypeError: Store is not a constructor` が throw されていた
  - 対応: `electron-store` を **v8.2.0**（CJS 互換最後のメジャー）にダウングレード。API 互換のため `connectionStore.ts` の修正は不要
  - 影響: v1.0.0 では接続管理を経由する全機能（接続追加 / 一覧 / Test Connection / open / close）が起動できなかった。v1.0.1 で全て復旧

### Improved

- **App.tsx の `useEffect` に `.catch()` ハンドラを追加**
  - サイレント固着の構造的再発防止。boot 時の Promise reject を `bootError` state に格納し、`BootErrorPanel` で UI に surface
  - 「再試行（リロード）」ボタンを提供
  - 主因（electron-store interop）が直っても、他の reject 源（SSH / SFTP 失敗等）で同種のサイレント固着が再発するため、構造的改善として併用

### Notes

- 配布される `CCPIT-R-Setup-1.0.1.exe` は **未署名** （v1.0.0 と同じく署名証明書未取得）。SmartScreen 警告が出ます。「詳細情報 → 実行」で進んでください。署名は v1.1 以降の TODO

---

## [1.0.0] — 2026-05-10 ⚠

> ⚠ **本バージョンは起動時に Loading 画面で固着する致命的バグを含みます。利用者は v1.0.1 にアップデートしてください。**

### Added

- 初回公開（CCPIT-R Phase 1）
- SSH 接続管理（Tailscale 経由、SSH 鍵認証、Test Connection）
- リモート PJ 一覧（`~/.claude/projects/` を SFTP で列挙、jsonl の `cwd` フィールドから path 復元）
- ワンクリック起動（`cd <pj> && claude` を SSH shell channel で実行）
- 内蔵 PTY ペイン（xterm.js + ssh2 shell channel、Pattern A、ANSI / UTF-8 / 日本語 / 絵文字対応）
- NSIS Windows インストーラ
- マゼンタアクセント UI + Type R 風 R エンブレム

### Tech Stack

- Electron 39 + React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS v4
- SSH: `ssh2` (pure JS、PTY allocation 内蔵)
- Terminal: `@xterm/xterm` + `@xterm/addon-fit`
- Persist: `electron-store` v10 → ⚠ v1.0.1 で v8 にダウングレード

[1.0.1]: https://github.com/VTRiot/telemetry-win/releases/tag/v1.0.1
[1.0.0]: https://github.com/VTRiot/telemetry-win/releases/tag/v1.0.0
