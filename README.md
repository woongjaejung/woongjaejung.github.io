# woongjaejung.github.io

Personal portfolio — bilingual (EN/KO), auto-synced with my GitHub repos, rendered three ways from the same data.

## How it works

- `data/repos.json` — **auto-generated**. A GitHub Action
  (`.github/workflows/update-repos.yml`) refreshes it daily at 00:00 UTC
  (09:00 KST) and on manual dispatch. **Never edit by hand.**
- `data/content.json` — **hand-edited**. Everything else lives here.

## Views

| URL | View | Notes |
|---|---|---|
| `/` (`index.html`) | Genome browser | default. Projects = genes, career = coverage, papers = peaks (click → 3D structure from RCSB) |
| `/run.html` | Run monitor | the same career as a sequencing run |
| `/classic.html` | Classic | the bento-grid page; fastest path to résumé and links |

The last view you opened is remembered in this browser. `index.html?view=browser` always opens the genome browser.

## Editing content (`data/content.json`)

| To do this | Edit this |
|---|---|
| Hide a repo from the page | Add its name to `exclude_repos` |
| Korean description for a repo | Add `repo_overrides.<repo-name>.description_ko` |
| Add work experience | Append to `experience`: `{ "period": "2024 –", "title": {"en", "ko"}, "org": {"en", "ko"}, "summary": {"en", "ko"} }` |
| Add a publication | Append to `publications`: `{ "year": "2025", "title": "…", "venue": "…", "authors": "…", "link": "https://…" }` |
| Add education | Append to `education`: `{ "period": "…", "degree": {"en", "ko"}, "school": {"en", "ko"} }` |
| Change bio / skills / contact | `profile`, `skills`, `contact` |
| Sidebar one-liner (separate from the full About text) | `profile.intro` — `{"en", "ko"}`; falls back to `profile.about` if omitted |
| Where career counting starts (run monitor yield) | `profile.career_start` (`"YYYY.MM"`) |
| Award shown as Run QC | `profile.award` `{en, ko, year}` (remove to hide the tile) |
| Skill proficiency / years (variant panel) | `skills[]` `{name, chrom, af 0–1, dp years, info}` |
| Skill × year heatmap | `skill_timeline` — `years: [from, to]`, one `values` entry per year (0–4) |
| 3D structure for a paper | `publications[].pdb` (RCSB id or `null`), `pdb_chain`, `gene`, `blurb {en, ko}` |
| Force a repo onto a chromosome / name its exons | `repo_overrides.<repo>.chromosome` (`chrAI`/`chrNGS`/`chrInfra`), `repo_overrides.<repo>.exons` |

Sections with empty arrays (`experience`, `publications`, `education`) are
hidden automatically, including their nav links.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening the files directly (`file://…`) will not work — all three views load ES modules,
which browsers block from `file://` origins. Serve over HTTP.

## Refresh repo data manually

Actions tab → "Update repos data" → Run workflow. Or locally:

```bash
GITHUB_TOKEN=$(gh auth token) node scripts/fetch-repos.mjs
```

## Tests

```bash
node --test
```
