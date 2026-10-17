# Design — Barangay Poblacion Portal

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
modern-minimal

## Macrostructure family
- Marketing / Public Landing: Asymmetric Split Portal (civic heraldry, verified service directory, explicit CTAs)
- App pages (Resident & Admin): Workbench (consistent top/sidebar layout, hairline elevated cards, structured record cards)
- Content / Modals / Notices: Utilitarian Clean (border-radius constrained, tokenized status badges, no raw side-stripes)

## Theme
- `--color-paper`:      oklch(0.985 0.005 240) /* #f8fafc slate tint, avoids harsh pure white */
- `--color-paper-2`:    oklch(0.965 0.008 240) /* card surface layer */
- `--color-ink`:        oklch(0.180 0.030 260) /* #0f172a deep navy ink */
- `--color-ink-2`:      oklch(0.460 0.025 250) /* #64748b secondary muted text */
- `--color-rule`:       oklch(0.895 0.012 240) /* #e2e8f0 hairline border */
- `--color-accent`:     oklch(0.350 0.120 260) /* #141b4d primary civic navy */
- `--color-accent-ink`: oklch(0.985 0.005 240) /* light text on accent */
- `--color-focus`:      oklch(0.550 0.180 250) /* accessible focus blue */
- `--color-warning`:    oklch(0.720 0.160 70)  /* amber notice */
- `--color-warning-bg`: oklch(0.970 0.030 80)
- `--color-danger`:     oklch(0.550 0.200 25)  /* crimson alert */
- `--color-danger-bg`:  oklch(0.970 0.025 25)
- `--color-success`:    oklch(0.550 0.150 150) /* emerald success */
- `--color-success-bg`: oklch(0.970 0.025 150)

## Typography
- Display: 'Segoe UI', system-ui, sans-serif, weight 700, style normal
- Body:    'Segoe UI', -apple-system, Roboto, sans-serif, weight 400/500
- Numeric / Monospace: ui-monospace, 'Geist Mono', SFMono-Regular, monospace
- Display tracking: -0.02em
- Headings are strictly roman (no italic headers).

## Spacing
- 4-point scale:
  - `--space-3xs`: 0.25rem (4px)
  - `--space-2xs`: 0.5rem (8px)
  - `--space-xs`:  0.75rem (12px)
  - `--space-sm`:  1rem (16px)
  - `--space-md`:  1.5rem (24px)
  - `--space-lg`:  2rem (32px)

## Motion
- Easings: cubic-bezier(0.16, 1, 0.3, 1) (`--ease-out`)
- Reveal pattern: none or subtle opacity-only (≤ 150ms). No bounce or wobble.

## CTA Voice
- Primary CTA: Solid civic navy fill (`var(--color-accent)`), rounded-md (8px), clear action verb ("Submit Complaint", "Create Account").
- Secondary CTA: Crisp outline on paper, 1px hairline border, hover tint.

## What pages MUST share
- The official Barangay Poblacion insignia and municipal naming hierarchy.
- The single accent hue (`--color-accent`).
- Tokenized status alerts: hairline border + badge pill (never thick asymmetric left-stripes).
- Roman display headings and consistent form focus styling (`var(--color-focus)`).
