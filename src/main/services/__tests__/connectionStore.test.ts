import { describe, it, expect } from 'vitest'

// v1.0.0 → v1.0.1 で root cause だった「electron-store@10 が ESM-only で require() の interop が
// 壊れ、Store が constructor として認識されない」を再発防止するための smoke test。
//
// vitest 環境では electron の app.getPath('userData') が無く実 instance 化はできないため、
// **default export が constructor として呼べる形（typeof === 'function'）** を最低限確認する。
// 統合的な instance 化検証は build:win 後の `dist/win-unpacked/CCPIT-R.exe --enable-logging`
// での実機ログで担保する（debug-toolkit 型 7「負の不変条件はテストで明示」最小適用）。
//
// Phase 2 で playwright-electron による E2E 統合テストへ拡張予定。

describe('electron-store import shape (v1.0.1 regression guard)', () => {
  it('default export が constructor として解決される（CJS interop 境界テスト）', async () => {
    const mod = await import('electron-store')
    // ESM-only 版だと mod.default が undefined または非 constructor、
    // CJS 版（v8.2.0）では mod.default が constructor 関数として解決される
    const Store = mod.default
    expect(typeof Store).toBe('function')
  })
})
