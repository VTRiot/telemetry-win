import { describe, it, expect } from 'vitest'
import { deriveDisplayNameFromSlug } from '../projectList'

describe('deriveDisplayNameFromSlug', () => {
  it('単純な slug の最後セグメントを返す', () => {
    expect(deriveDisplayNameFromSlug('-Users-raio--Prog-mbp-setup')).toBe('setup')
  })

  it('jsonl の cwd 取得失敗時の fallback として動く', () => {
    expect(deriveDisplayNameFromSlug('-Users-raio--Prog-oc-mbp-setup')).toBe('setup')
  })

  it('先頭が - で始まらない場合はそのまま', () => {
    expect(deriveDisplayNameFromSlug('not-a-slug')).toBe('not-a-slug')
  })

  it('空文字はそのまま', () => {
    expect(deriveDisplayNameFromSlug('')).toBe('')
  })

  it('ハイフンを含まない slug はそのまま（理論上ありえないが安全側）', () => {
    expect(deriveDisplayNameFromSlug('singleword')).toBe('singleword')
  })
})
