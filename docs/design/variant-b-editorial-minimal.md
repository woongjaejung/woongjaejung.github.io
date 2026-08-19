# Variant B — "Editorial Minimal" (preserved on branch)

- **Branch:** `redesign/editorial-minimal` — the **full implementation is
  preserved on this branch**; check it out to view or re-apply the design.
- **Status:** Not adopted (Variant A "Bento Grid" was chosen), kept for
  reference.

## Concept / Direction

A warm-paper editorial spread: oversized serif display type, thin horizontal
rules, CSS-counter numbered sections, and projects presented as a quiet
text-first list instead of cards. Feels like a printed magazine index page,
with a muted terracotta accent. Light theme is the default (unlike the
original site and Variant A).

## Layout System

- **Single-column editorial flow**, `max-width: 68rem` (`--max`), generous
  whitespace, sections separated by 1px rules (`--rule`).
- **Sticky top bar** (not floating): brand in italic serif, uppercase
  letter-spaced nav links, blurred translucent paper background
  (`color-mix(in srgb, var(--bg) 88%, transparent)` + 10px backdrop blur).
- **Numbered sections:** `main { counter-reset: sec }`, each section heading
  `counter-increment: sec` and renders `counter(sec, decimal-leading-zero)`
  → "01", "02", … prefixes.
- **Projects as thin-rule list rows** (not cards): each entry is a row under a
  1px rule; description and tech-chip row are hidden by default and
  **revealed on hover** — pointer devices only, gated behind
  `@media (hover: hover) and (pointer: fine)` so touch users always see
  full details.
- **Paper grain:** `body::before` fixed overlay with an SVG fractal-noise
  texture at `opacity: 0.35` (very low alpha in the noise itself).

## Color Palette

### Light theme (default, `color-scheme: light`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#f6f1e7` | Warm cream paper background |
| `--bg-raised` | `#fdfaf3` | Raised surfaces |
| `--ink` | `#211d17` | Headings / strong text |
| `--body` | `#4d463b` | Body text |
| `--muted` | `#877d6c` | Secondary text |
| `--accent` | `#99442a` | Muted terracotta accent |
| `--rule` | `rgba(33, 29, 23, 0.16)` | Thin rules |
| `--rule-strong` | `rgba(33, 29, 23, 0.55)` | Emphasis rules / underlines |
| `--shadow` | `rgba(60, 48, 30, 0.14)` | Soft shadows |

### Dark editorial theme (`[data-theme="dark"]`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#191511` | Warm near-black |
| `--bg-raised` | `#221d18` | Raised surfaces |
| `--ink` | `#ede5d7` | Headings |
| `--body` | `#b6ac9b` | Body text |
| `--muted` | `#8b8172` | Secondary text |
| `--accent` | `#d4906a` | Lightened terracotta |
| `--rule` | `rgba(237, 229, 215, 0.16)` | Thin rules |
| `--shadow` | `rgba(0, 0, 0, 0.4)` | Shadows |

## Typography

- **Display:** [Fraunces](https://fonts.google.com/specimen/Fraunces)
  variable serif (opsz 9–144, wght 400–700, roman + italic) — oversized hero
  headline, italic brand mark.
- **Body / UI:** Archivo (400, 500, 600) — uppercase letter-spaced
  (`0.14em`) nav links and buttons.
- **Korean fallback:** Noto Sans KR (400, 500, 700).
- **Mono:** system mono stack (no webfont).
- Base: 1rem, line-height 1.7.

## Motion / Interaction

- **Signature easing:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
  (strong ease-out, "settling ink" feel).
- **Reveals:** `.reveal` (opacity 0, `translateY(20px)`, 0.55s) → `.reveal.in`
  via IntersectionObserver; `@keyframes rise` for hero entrance.
- **Hover-reveal project details:** description + chips slide/fade in on row
  hover (pointer-fine devices only); arrow glyph nudges `translate(3px, -3px)`.
- **Micro-interactions:** underline-grow on nav/toggle hover, `scale(0.96)`
  press state on toggles.
- **Accessibility:** `prefers-reduced-motion: reduce` disables reveals, rise,
  and hover transforms.

## Contract Notes

All JS contract IDs kept. **One test expectation changed on this branch:**
the default theme is `light` (the branch updates the corresponding test).
Tests on the branch: 16/16 pass. If re-applying this design onto `main`,
remember to flip the default-theme test expectation back to `light`.
