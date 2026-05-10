import { describe, it, expect } from 'vitest'
import { CLAUDE_LAUNCH_COMMAND } from '../constants'

// v1.0.3 で追加。CLAUDE_LAUNCH_COMMAND の以下を保証する:
// 1. 絶対 POSIX path で正しい cd && claude を組み立てる
// 2. 相対パス / slug 風の引数では throw（v1.0.2 致命バグの再発防止）
// 3. シングルクォートを含む path のシェル escape が POSIX 流儀で正しい
//
// debug-toolkit 型 7「負の不変条件はテストで明示」最小適用。
// 統合的な PTY 起動検証は build:win 後の dist 起動 + probe ログで担保する。

describe('CLAUDE_LAUNCH_COMMAND', () => {
  it('絶対 POSIX path で `cd ... && claude` を組み立てる', () => {
    const cmd = CLAUDE_LAUNCH_COMMAND('/Users/raio/_Prog/mbp-setup')
    expect(cmd).toBe(`cd '/Users/raio/_Prog/mbp-setup' && claude`)
  })

  it('slug 形式 (`-` 始まり) は throw する (v1.0.2 致命バグの再発防止 guard)', () => {
    expect(() => CLAUDE_LAUNCH_COMMAND('-Users-raio--Prog-mbp-setup')).toThrow(
      /must be an absolute POSIX path/
    )
  })

  it("シングルクォートを含む path を POSIX 流儀で escape する ('\\'' パターン)", () => {
    const cmd = CLAUDE_LAUNCH_COMMAND(`/Users/raio/'quoted'/dir`)
    // 期待: `cd '/Users/raio/'\''quoted'\''/dir' && claude`
    expect(cmd).toBe(`cd '/Users/raio/'\\''quoted'\\''/dir' && claude`)
  })
})
