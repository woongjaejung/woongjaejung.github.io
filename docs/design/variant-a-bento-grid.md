# Variant A — "Bento Grid" (adopted)

- **Branch:** `redesign/bento-grid` (merged into `main`; this is the live design)
- **Status:** Adopted as the production design.

## Concept / Direction

Ethereal glass surfaces floating on a deep navy-black void. An asymmetric bento
grid gives each section its own "tile" personality while a single mint accent
keeps the palette disciplined. Mono-spaced micro-labels add an engineering feel
against the geometric Outfit display type.

## Layout System

- **12-column asymmetric bento grid** (`.bento` container). Cards span varying
  column/row counts to create an intentional, magazine-like asymmetry rather
  than a uniform card grid.
- **Floating glass pill navigation**: fixed, horizontally centered
  (`top: 1.1rem; left: 50%; translateX(-50%)`), frosted-glass background.
- Cards are two-layer glass: an outer `--shell-bg` shell with `--shell-pad:
  0.4rem` inset and an inner `--core-bg` core, both with subtle
  1px light borders and `--radius: 1.9rem` rounding.
- Ambient background layers (all `position: fixed`, pointer-events none):
  - `.orbs` — three mesh-gradient radial orbs (mint + blue tints)
  - `.grain` — SVG fractal-noise film grain at `opacity: 0.032`
  - `#spotlight` — 620px radial glow following the cursor
    (`--mx`/`--my` CSS vars set from JS)

## Color Palette

### Dark theme (default, `color-scheme: dark`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#05070d` | Page background (deep navy-black) |
| `--core-bg` | `rgba(10, 15, 26, 0.55)` | Card inner surface |
| `--shell-bg` | `rgba(255, 255, 255, 0.04)` | Card outer shell |
| `--card-border` | `rgba(255, 255, 255, 0.09)` | Card borders |
| `--text` | `#e8edf7` | Headings |
| `--text-body` | `#a7b2c8` | Body text |
| `--muted` | `#78839c` | Secondary text |
| `--accent` | `#7be3c4` | Mint accent (links, highlights) |
| `--glow` | `rgba(123, 227, 196, 0.22)` | Selection / glow effects |
| `--shadow` | `rgba(2, 6, 16, 0.65)` | Card shadows |

Orb gradients: `rgba(64, 201, 162, …)` mint and `rgba(72, 118, 186, …)` blue.

### Light theme (`[data-theme="light"]`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#eef1f6` | Page background (cool light gray) |
| `--core-bg` | `rgba(255, 255, 255, 0.72)` | Card inner surface |
| `--text` | `#131c30` | Headings |
| `--text-body` | `#46516b` | Body text |
| `--muted` | `#67718c` | Secondary text |
| `--accent` | `#0c7a68` | Deep teal accent |
| `--shadow` | `rgba(23, 32, 54, 0.16)` | Card shadows |

## Typography

- **Display / body:** [Outfit](https://fonts.google.com/specimen/Outfit)
  (400–800), fallback `Noto Sans KR` for Korean, then system sans.
- **Micro-labels / code:** IBM Plex Mono (400, 500), used for section labels
  and metadata chips.
- Base: 16px, line-height 1.65, antialiased.

## Motion / Interaction

- **Signature easing:** `--ease: cubic-bezier(0.32, 0.72, 0, 1)` (fast start,
  soft settle).
- **IntersectionObserver staggered reveals:** cards get `.reveal`
  (opacity 0 + translateY), flip to `.reveal.in` when entering the viewport;
  per-card stagger via `transition-delay: var(--d)` set from JS. Observer
  unobserves after first reveal (one-shot).
- **Nav entrance:** `@keyframes nav-drop` on load (`.stagger` class).
- **Cursor spotlight:** `#spotlight` radial gradient tracks pointer position.
- **Hover:** revealed cards lift `translateY(-3px)`.
- **Scroll-spy:** IntersectionObserver highlights the active nav link.
- **Accessibility:** full `prefers-reduced-motion: reduce` block disables
  reveals, nav-drop, and hover transforms; smooth scrolling with
  `scroll-padding-top: 6.5rem` for the fixed nav.

## Contract Notes

All JS contract IDs from the original design were kept (`#site-nav`,
`#project-grid`, `#spotlight`, theme/lang toggles, etc.), so
`assets/js/main.js` and `assets/js/logic.mjs` needed no contract changes.
Default theme remains **dark**. Tests: 16/16 pass.
