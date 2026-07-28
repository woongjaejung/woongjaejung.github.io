# wf4006hufman.github.io

Personal portfolio — bilingual (EN/KO), auto-synced with my GitHub repos.

## How it works

- `data/repos.json` — **auto-generated**. A GitHub Action
  (`.github/workflows/update-repos.yml`) refreshes it daily at 00:00 UTC
  (09:00 KST) and on manual dispatch. **Never edit by hand.**
- `data/content.json` — **hand-edited**. Everything else lives here.

## Editing content (`data/content.json`)

| To do this | Edit this |
|---|---|
| Hide a repo from the page | Add its name to `exclude_repos` |
| Korean description for a repo | Add `repo_overrides.<repo-name>.description_ko` |
| Add work experience | Append to `experience`: `{ "period": "2024 –", "title": {"en", "ko"}, "org": {"en", "ko"}, "summary": {"en", "ko"} }` |
| Add a publication | Append to `publications`: `{ "year": "2025", "title": "…", "venue": "…", "authors": "…", "link": "https://…" }` |
| Add education | Append to `education`: `{ "period": "…", "degree": {"en", "ko"}, "school": {"en", "ko"} }` |
| Change bio / skills / contact | `profile`, `skills`, `contact` |

Sections with empty arrays (`experience`, `publications`, `education`) are
hidden automatically, including their nav links.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Refresh repo data manually

Actions tab → "Update repos data" → Run workflow. Or locally:

```bash
GITHUB_TOKEN=$(gh auth token) node scripts/fetch-repos.mjs
```

## Tests

```bash
node --test tests/
```
