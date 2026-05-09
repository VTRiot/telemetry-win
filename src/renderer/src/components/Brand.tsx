import type { JSX } from 'react'

interface BrandProps {
  version: string
}

// ロゴ・タイトル要素。Anchor: Telemetry_LogoColor_Anchor_Fragment_2026-05-08
//  - CC = マゼンタ単色（V1）
//  - PIT = 銀電飾
//  - R = Type R / GT-R 風（CSS グラデで再現、Phase 1 は SVG なし）
export function Brand({ version }: BrandProps): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-baseline gap-1 select-none">
        <span className="cc-emblem text-2xl tracking-tight">CC</span>
        <span className="pit-emblem text-2xl tracking-tight">PIT</span>
        <span className="text-[var(--muted-foreground)] mx-0.5">-</span>
        <span className="r-emblem text-2xl">R</span>
      </div>
      <span className="text-xs text-[var(--muted-foreground)]">v{version}</span>
      <span className="text-xs text-[var(--muted-foreground)]">Remote Operator</span>
    </div>
  )
}
