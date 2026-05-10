# Changelog

All notable changes to CCPIT-R (codename Telemetry) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] — 2026-05-11

### Fixed

- **【致命】PJ 起動時に cwd が PJ ディレクトリではなくホーム (`/Users/raio`) になっていたバグ**
  - 症状: PJ クリック後、CC が `/Users/raio` で起動。CC 側で「Quick safety check: Is this a project you created or one you trust?」が出る (cwd が PJ じゃないため CC が警告)
  - 根因: `readPjCwd()` が jsonl の **最初の line のみ** JSON.parse していたが、新形式の CC ログでは先頭が `{"type":"permission-mode"}` 等のメタ record で `cwd` フィールドを持たない (実機 hrd-mac01 で実測、2026-05-11)。全 PJ で fallback 経路に入り `pjPath = slug` (`-Users-raio--Prog-mbp-setup`) → `cd '-Users-...' && claude` 失敗 → cwd=Home で claude 起動
  - 対応: `readPjCwd()` を **複数行スキャン化**。先頭 16 KB を line ごとに JSON.parse、`cwd` (絶対 POSIX path) を持つ最初の record を採用
  - 補強: `CLAUDE_LAUNCH_COMMAND` に絶対パス guard 追加 (`pjPath.startsWith('/')` 違反で throw、debug-toolkit 型 7 多層防御)
  - 補強: `PtyPane` で pjPath 未解決 (slug のまま) を検出した場合、PTY を起動せず `UnresolvedPathPanel` でエラー UI を描画 (silent failure 回避、v1.0.1 `BootErrorPanel` と同パターン)

### Changed

- **右ペインタイトル**: slug 生表示 (`-Users-raio--Prog-mbp-setup`) を廃止。**displayName 主タイトル + pjPath サブ**の 2 行構造に変更 (例: `mbp-setup` / `/Users/raio/_Prog/mbp-setup`)
- **タイトルバー左上アイコン**: 旧 CCPIT 本体 (橙) のままだった `resources/icon.png` を CCPIT-R マゼンタ版 256×256 に差し替え (Pillow リサイズ)。v1.0.2 で .ico は更新済だったが BrowserWindow.icon の参照は未更新だった残課題を解消

### Added

- 新規ユニットテスト `launchCommand.test.ts` 3 件 (絶対パス OK / slug reject / quote escape)。debug-toolkit 型 7「負の不変条件はテストで明示」最小適用

### Notes

- 機能変更なし、Phase 1 中核機能 (ワンクリックで `cd && claude`) の復旧
- v1.0.2 から **強く更新推奨** (PJ 起動が事実上機能していなかったため)
- インストーラは引き続き **未署名** (v1.0.0〜v1.0.3 同じ、v1.1 で対応予定)

---

## [1.0.2] — 2026-05-10

### Changed

- **アプリアイコンを CCPIT-R 専用ブランド画像に置換**
  - 旧: CCPIT 本体（CC=橙）流用
  - 新: マゼンタ系 CCPIT-R 公式ロゴ（らいお生成）
  - `build/icon.ico` をマルチサイズ（256/128/64/48/32/16）で再生成（Pillow 12.1.0）
  - インストーラ Setup.exe / インストール後の exe / タスクバー / スタートメニューすべて新アイコンに切り替わる
  - 透過化は今回見送り（PIT 銀電飾の影破綻リスク、Phase 2 で別途検討）

### Added

- **起動時スプラッシュ画面**（CCPIT-R 横長ロゴ、540×234、最低 1500ms 表示）
  - 起動時の「アプリが起動したか分からない」初期 UX 不確実性を解消
  - `resources/splash.html` + `resources/CCPIT-R_V1.png` を `extraResources` 経由で配信
  - main プロセスで `createSplashWindow()` → `mainWindow.on('ready-to-show')` で残時間待ち → `splash.destroy() + main.show()`
  - CCPIT (sibling Win app) の splash 仕組みを最小抽出（`splashRareChance` 演出 / `appConfig` 依存は持ち込まず）

### Notes

- 機能変更なし、ブランディングのみのアップデート。v1.0.1 からの更新は **任意**
- インストーラは引き続き **未署名**（v1.0.0 / v1.0.1 と同じ、コード署名証明書取得は v1.1 ロードマップ）

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

[1.0.3]: https://github.com/VTRiot/telemetry-win/releases/tag/v1.0.3
[1.0.2]: https://github.com/VTRiot/telemetry-win/releases/tag/v1.0.2
[1.0.1]: https://github.com/VTRiot/telemetry-win/releases/tag/v1.0.1
[1.0.0]: https://github.com/VTRiot/telemetry-win/releases/tag/v1.0.0
