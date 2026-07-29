# Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 포트폴리오 페이지의 비주얼 레이어를 승인된 "다크 엔지니어" 디자인(2컬럼 고정 사이드바 + 모션)으로 교체한다.

**Architecture:** 데이터 구조·자동화 파이프라인·언어 로직은 건드리지 않는다. 교체 대상은 `index.html`(마크업 구조), `assets/css/style.css`(전면), `assets/js/main.js`(렌더링 DOM 구조 + 테마 토글 + 모션). 테마 결정 로직은 언어 로직과 같은 패턴으로 `assets/js/logic.mjs`의 순수 함수로 분리해 테스트한다.

**Tech Stack:** HTML/CSS/vanilla JS(ES modules), Node 22 `node:test`. 외부 폰트·라이브러리·빌드 도구 없음.

**Spec:** `docs/superpowers/specs/2026-07-29-portfolio-redesign-design.md`
**시각 기준(목업):** `docs/design/redesign-mockup.html` — 이 파일이 시각적 source of truth다. 명세와 목업이 충돌하면 목업이 우선한다.

## Global Constraints

- 프레임워크·빌드 도구·npm 의존성 금지. 외부 폰트/아이콘/애니메이션 라이브러리 금지. 테스트는 Node 내장 `node:test`만 사용.
- 커밋 author/committer는 항상 `Woongjae (Jae) Jung <woongjaej2@gmail.com>` (repo에 `git config` 완료됨). `Co-Authored-By: Claude` 등 AI 서명 트레일러 금지.
- **데이터 파일(`data/content.json`, `data/repos.json`)과 `scripts/`, `.github/workflows/`는 이 계획에서 수정하지 않는다.** 렌더링 코드가 데이터에 맞춰야 하며 그 반대가 아니다.
- 언어 정책 불변: 영어 기본(`resolveInitialLang`), localStorage 키 `lang`, 저장 실패는 무시.
- **테마: 다크 기본**, localStorage 키 `theme`, 저장 실패는 무시. `prefers-color-scheme` 자동 감지 안 함.
- 액센트 텍스트는 두 테마 모두 WCAG AA 4.5:1 이상.
- 모든 동적 콘텐츠는 `textContent`/`createElement`로만 삽입 (`innerHTML` 금지 — XSS 표면 0 유지).
- 외부 링크는 전부 `target="_blank"` + `rel="noopener"`.
- 빈 배열인 `experience`/`publications`/`education`은 섹션과 네비게이션 링크를 함께 숨긴다 (기존 동작 유지).
- `prefers-reduced-motion: reduce`에서 모든 모션·`scroll-behavior`를 비활성화한다.
- 기존 테스트 14건은 계속 통과해야 한다.

## File Structure

```
index.html                 # 2컬럼 셸로 재작성 (Task 2)
assets/css/style.css       # 전면 재작성 — 다크 토큰 + 2컬럼 + 모션 (Task 2, 4)
assets/js/logic.mjs        # resolveInitialTheme 추가 (Task 1)
assets/js/main.js          # 렌더링 DOM 구조 조정 (Task 2), 테마 토글 (Task 3), 모션 (Task 4)
tests/logic.test.mjs       # 테마 로직 테스트 추가 (Task 1)
docs/design/redesign-mockup.html  # 참조 전용 — 수정하지 않는다
```

---

### Task 1: 테마 결정 로직

**Files:**
- Modify: `assets/js/logic.mjs` (파일 끝에 함수 추가)
- Test: `tests/logic.test.mjs` (파일 끝에 테스트 추가)

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces: `resolveInitialTheme(stored: string|null) => "dark"|"light"` — 저장값이 정확히 `"dark"` 또는 `"light"`면 그 값, 그 외(null/undefined/쓰레기값)는 `"dark"`. 기존 `resolveInitialLang(stored)`와 동일한 패턴이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/logic.test.mjs`의 import 목록에 `resolveInitialTheme`를 추가한다. 현재 import는 다음과 같다:

```js
import {
  resolveInitialLang,
  translate,
  repoDescription,
  pick,
} from "../assets/js/logic.mjs";
```

이것을 다음으로 바꾼다:

```js
import {
  resolveInitialLang,
  resolveInitialTheme,
  translate,
  repoDescription,
  pick,
} from "../assets/js/logic.mjs";
```

그리고 파일 끝에 테스트를 추가한다:

```js
test("resolveInitialTheme: 저장값이 유효하면 그대로", () => {
  assert.equal(resolveInitialTheme("dark"), "dark");
  assert.equal(resolveInitialTheme("light"), "light");
});

test("resolveInitialTheme: 저장값이 없거나 이상하면 다크가 기본", () => {
  assert.equal(resolveInitialTheme(null), "dark");
  assert.equal(resolveInitialTheme(undefined), "dark");
  assert.equal(resolveInitialTheme("garbage"), "dark");
  assert.equal(resolveInitialTheme(""), "dark");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/logic.test.mjs`
Expected: FAIL — `resolveInitialTheme is not a function` (또는 import 관련 에러)

- [ ] **Step 3: 구현**

`assets/js/logic.mjs` 파일 끝에 추가한다:

```js
export function resolveInitialTheme(stored) {
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
}
```

- [ ] **Step 4: 전체 테스트 통과 확인**

Run: `node --test`
Expected: PASS — 16 tests (기존 14 + 신규 2)

- [ ] **Step 5: Commit**

```bash
git add assets/js/logic.mjs tests/logic.test.mjs
git commit -m "feat: add theme resolution logic"
```

---

### Task 2: 새 셸 — 마크업·스타일·렌더링 구조 교체

이 태스크는 마크업·CSS·렌더링을 함께 바꾼다. 셋 중 하나만 바꾸면 페이지가 깨진 중간 상태가 되어 독립 검증이 불가능하기 때문이다. 결과물은 **모션과 테마 토글이 없는(다크 고정) 새 레이아웃 페이지**다.

**Files:**
- Modify: `index.html` (전면 재작성)
- Modify: `assets/css/style.css` (전면 재작성)
- Modify: `assets/js/main.js` (`applyStaticText`, `renderProjects`, `renderLists`, `renderContact`, `init` 조정)
- Read only: `docs/design/redesign-mockup.html`

**Interfaces:**
- Consumes: `data/content.json` 스키마 (`profile{name,tagline{en,ko},about{en,ko}}`, `skills[]`, `i18n{key:{en,ko}}`, `experience[{period,title{en,ko},org{en,ko},summary{en,ko}}]`, `publications[{year,title,venue,authors,link}]`, `education[{period,degree{en,ko},school{en,ko}}]`, `contact{email,links[{label,url}]}`), `data/repos.json` (`{updated_at, repos:[{name,description,language,topics,stars,pushed_at,html_url}]}`), `logic.mjs`의 `resolveInitialLang`/`translate`/`repoDescription`/`pick`.
- Produces: 새 DOM 계약 — id: `sidebar`, `side-nav`, `lang-toggle`, `theme-toggle`, `hero-name`, `hero-tagline`, `about-text`, `skill-list`, `project-grid`, `projects-updated`, `experience-list`, `publication-list`, `education-list`, `contact-links`, `year`, `spotlight`. class: `.entry`, `.entry-meta`, `.entry-body`, `.card`, `.chip`, `.tag`, `.label`, `.section`, `.toggle`, `.side-link`, `.muted`, `.small`, `.arrow`. Task 3·4가 이 계약에 의존한다.

- [ ] **Step 1: 목업 정독**

`docs/design/redesign-mockup.html`을 읽는다. 레이아웃 비율(사이드바 42% / 콘텐츠 58%), 색 토큰, 라벨 스타일, 카드 hover, 반응형 붕괴 지점을 파악한다. 이 태스크에서는 목업의 **정적 부분만** 구현한다 — 모션 스크립트(스포트라이트/리빌/스파이/스태거)와 테마 토글 동작은 Task 3·4에서 붙인다. 단, 마크업에는 `#spotlight` div와 `#theme-toggle` 버튼을 미리 넣어 둔다.

- [ ] **Step 2: `index.html` 재작성**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Woongjae (Jae) Jung — Bioinformatics · AI</title>
  <meta name="description" content="Portfolio of Woongjae (Jae) Jung — Senior Field Bioinformatics Support Scientist, AI Engineer, Ph.D. Bioinformatics & Epigenomics." />
  <link rel="stylesheet" href="assets/css/style.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>" />
</head>
<body>
  <div id="spotlight" aria-hidden="true"></div>

  <div class="shell">
    <aside id="sidebar">
      <div class="side-head">
        <h1 id="hero-name"></h1>
        <p id="hero-tagline" class="tagline"></p>
        <p id="about-text" class="intro"></p>
      </div>

      <nav id="side-nav" aria-label="Sections">
        <a class="side-link" href="#about" data-i18n="nav_about"></a>
        <a class="side-link" href="#projects" data-i18n="nav_projects"></a>
        <a class="side-link" href="#experience" data-i18n="nav_experience" data-section-link="experience"></a>
        <a class="side-link" href="#publications" data-i18n="nav_publications" data-section-link="publications"></a>
        <a class="side-link" href="#education" data-i18n="nav_education" data-section-link="education"></a>
        <a class="side-link" href="#contact" data-i18n="nav_contact"></a>
      </nav>

      <div class="side-foot">
        <div id="contact-links" class="chip-row"></div>
        <div class="toggles">
          <button id="lang-toggle" class="toggle" type="button" aria-label="Switch to Korean">KO</button>
          <button id="theme-toggle" class="toggle" type="button" aria-label="Switch to light theme">LIGHT</button>
        </div>
      </div>
    </aside>

    <main>
      <section id="about" class="section">
        <h2 class="label" data-i18n="heading_about"></h2>
        <p id="about-full" class="body-text"></p>
        <h3 class="sub-label" data-i18n="heading_skills"></h3>
        <div id="skill-list" class="chip-row"></div>
      </section>

      <section id="projects" class="section">
        <h2 class="label" data-i18n="heading_projects"></h2>
        <p class="muted small" data-i18n="projects_auto_note"></p>
        <div id="project-grid"></div>
        <p id="projects-updated" class="muted small"></p>
      </section>

      <section id="experience" class="section" hidden>
        <h2 class="label" data-i18n="heading_experience"></h2>
        <div id="experience-list"></div>
      </section>

      <section id="publications" class="section" hidden>
        <h2 class="label" data-i18n="heading_publications"></h2>
        <div id="publication-list"></div>
      </section>

      <section id="education" class="section" hidden>
        <h2 class="label" data-i18n="heading_education"></h2>
        <div id="education-list"></div>
      </section>

      <section id="contact" class="section">
        <h2 class="label" data-i18n="heading_contact"></h2>
        <div id="contact-links-main" class="chip-row"></div>
        <p class="muted small">© <span id="year"></span> Woongjae (Jae) Jung</p>
      </section>
    </main>
  </div>

  <script type="module" src="assets/js/main.js"></script>
</body>
</html>
```

주의: 사이드바의 짧은 소개(`#about-text`)와 About 섹션의 전체 소개(`#about-full`)는 서로 다른 요소다. 사이드바에는 태그라인만, About 섹션에 전체 소개문이 들어간다 — Step 4의 `applyStaticText`가 이를 처리한다.

`#publication-list`가 `<ol>`에서 `<div>`로 바뀌었다. 렌더링 코드도 `<li>` 대신 `<div class="entry">`를 만들어야 한다 (Step 4에서 처리).

- [ ] **Step 3: `assets/css/style.css` 전면 재작성**

```css
:root {
  --bg: #0a1628;
  --bg-panel: #112240;
  --text: #ccd6f6;
  --text-body: #a2aec9;
  --muted: #8892b0;
  --accent: #64ffda;
  --accent-soft: rgba(100, 255, 218, 0.08);
  --border: rgba(136, 146, 176, 0.18);
  --shadow: rgba(2, 12, 27, 0.7);
  --spot: rgba(100, 255, 218, 0.05);
  --max: 72rem;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Noto Sans KR", "Malgun Gothic", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

:root[data-theme="light"] {
  --bg: #f4f7fb;
  --bg-panel: #ffffff;
  --text: #17233b;
  --text-body: #3d4b66;
  --muted: #64748b;
  --accent: #0f766e;
  --accent-soft: rgba(15, 118, 110, 0.08);
  --border: rgba(100, 116, 139, 0.25);
  --shadow: rgba(15, 23, 42, 0.12);
  --spot: rgba(15, 118, 110, 0.05);
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text-body);
  font-family: var(--font-sans);
  line-height: 1.65;
  transition: background 0.3s ease, color 0.3s ease;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.muted { color: var(--muted); }
.small { font-size: 0.85rem; }
.body-text { max-width: 34rem; }

#spotlight {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    560px at var(--mx, 50%) var(--my, 30%),
    var(--spot),
    transparent 80%
  );
}

.shell {
  position: relative;
  z-index: 1;
  max-width: var(--max);
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  gap: 3rem;
}

/* ── sidebar ─────────────────────────── */
#sidebar {
  width: 42%;
  max-height: 100vh;
  overflow-y: auto;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  padding: 5.5rem 0 3rem;
}

#hero-name {
  margin: 0;
  font-size: clamp(2rem, 4.2vw, 3rem);
  letter-spacing: -0.03em;
  line-height: 1.12;
  color: var(--text);
  text-wrap: balance;
}

.tagline {
  margin: 0.9rem 0 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text);
}

.intro { margin: 0.9rem 0 0; max-width: 26rem; font-size: 0.95rem; }

#side-nav { margin-top: 3rem; display: none; flex-direction: column; }

.side-link {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.5rem 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  transition: color 0.2s ease;
}
.side-link::before {
  content: "";
  width: 2rem;
  height: 1px;
  background: var(--muted);
  transition: width 0.25s ease, background 0.25s ease;
}
.side-link:hover,
.side-link.active { color: var(--text); text-decoration: none; }
.side-link:hover::before,
.side-link.active::before { width: 4rem; background: var(--accent); }

.side-foot {
  margin-top: auto;
  padding-top: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}

.toggles { display: flex; gap: 0.5rem; }

.toggle {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}
.toggle:hover { border-color: var(--accent); color: var(--accent); }

/* ── content ─────────────────────────── */
main { width: 58%; padding: 5.5rem 0 6rem; }
.section { margin-bottom: 5rem; scroll-margin-top: 2rem; }

.label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.label::after {
  content: "";
  flex: 1;
  max-width: 8rem;
  height: 1px;
  background: var(--border);
}

.sub-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 1.8rem 0 0.8rem;
}

.chip-row { display: flex; flex-wrap: wrap; gap: 0.45rem; }

.chip, .skill-chip {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
}

.tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.12rem 0.6rem;
}

.contact-link {
  font-size: 0.85rem;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  transition: border-color 0.2s ease, color 0.2s ease;
}
.contact-link:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }

/* ── entries & cards ─────────────────── */
.entry, .card {
  display: grid;
  grid-template-columns: 9.5rem 1fr;
  gap: 0.2rem 1.4rem;
  padding: 1.1rem 1.2rem;
  margin: 0 -1.2rem 0.3rem;
  border-radius: 8px;
  border: 1px solid transparent;
}

.card {
  transition: background 0.25s ease, border-color 0.25s ease,
    box-shadow 0.25s ease, transform 0.25s ease;
}
.card:hover {
  background: var(--bg-panel);
  border-color: var(--border);
  box-shadow: 0 12px 30px -18px var(--shadow);
  transform: translateY(-2px);
  text-decoration: none;
}

.entry-meta {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--muted);
  padding-top: 0.3rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.entry-body h3, .entry-body strong {
  display: block;
  margin: 0;
  font-size: 1rem;
  color: var(--text);
  font-weight: 600;
}
.entry-body h3 { display: flex; align-items: center; gap: 0.4rem; }
.card:hover .entry-body h3 { color: var(--accent); }

.arrow { display: inline-block; color: var(--accent); transition: transform 0.25s ease; }
.card:hover .arrow { transform: translate(4px, -4px); }

.entry-body .org { color: var(--muted); font-size: 0.9rem; margin: 0.1rem 0 0; }
.entry-body p { margin: 0.4rem 0 0.6rem; font-size: 0.9rem; }
.entry-body .chip-row { margin-top: 0.5rem; }

/* ── responsive ──────────────────────── */
@media (min-width: 900px) { #side-nav { display: flex; } }

@media (max-width: 899px) {
  .shell { flex-direction: column; gap: 0; padding: 0 1.5rem; }
  #sidebar {
    width: 100%;
    position: static;
    max-height: none;
    overflow: visible;
    padding: 3.5rem 0 0;
  }
  main { width: 100%; padding: 2.5rem 0 4rem; }
  .side-foot { margin-top: 1.5rem; padding-top: 0; }
}

@media (max-width: 560px) {
  .entry, .card { grid-template-columns: 1fr; gap: 0.35rem; }
  .entry-meta { padding-top: 0; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  body, .card, .toggle, .side-link, .side-link::before, .contact-link,
  .arrow { transition: none; }
  .card:hover { transform: none; }
  .card:hover .arrow { transform: none; }
}

.toggle:focus-visible, a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}
```

- [ ] **Step 4: `assets/js/main.js` 렌더링 조정**

기존 파일의 `applyStaticText`, `renderProjects`, `renderLists`, `renderContact`, `renderAll`, `init`을 아래로 교체한다. `loadJSON`, `readStoredLang`, `storeLang`, `el`, `renderSkills`, `renderEntrySection`, `setLang`, 최하단 `init().catch(...)`는 그대로 둔다.

```js
function applyStaticText() {
  const { i18n, profile } = state.content;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translate(i18n, node.dataset.i18n, state.lang);
  });
  document.documentElement.lang = state.lang;

  const langToggle = document.getElementById("lang-toggle");
  langToggle.textContent = state.lang === "en" ? "KO" : "EN";
  langToggle.setAttribute(
    "aria-label",
    state.lang === "en" ? "Switch to Korean" : "영어로 전환"
  );

  document.getElementById("hero-name").textContent = profile.name;
  document.getElementById("hero-tagline").textContent = pick(profile.tagline, state.lang);

  const about = pick(profile.about, state.lang);
  document.getElementById("about-text").textContent = about.split(". ")[0] + ".";
  document.getElementById("about-full").textContent = about;
}

function makeEntry(metaText, buildBody, href) {
  const entry = el(href ? "a" : "div", href ? "card" : "entry");
  if (href) {
    entry.href = href;
    entry.target = "_blank";
    entry.rel = "noopener";
  }
  entry.appendChild(el("span", "entry-meta", metaText));
  const body = el("div", "entry-body");
  buildBody(body);
  entry.appendChild(body);
  return entry;
}

function renderProjects() {
  const grid = document.getElementById("project-grid");
  const updated = document.getElementById("projects-updated");
  const { i18n, repo_overrides } = state.content;

  if (!state.repos) {
    const fallback = el(
      "p",
      "muted small",
      translate(i18n, "projects_fallback", state.lang) + " "
    );
    const link = el("a", null, "github.com/wf4006hufman");
    link.href = "https://github.com/wf4006hufman";
    link.target = "_blank";
    link.rel = "noopener";
    fallback.appendChild(link);
    grid.replaceChildren(fallback);
    updated.textContent = "";
    return;
  }

  grid.replaceChildren(
    ...state.repos.map((repo) => {
      const meta = [repo.language, repo.stars > 0 ? `★ ${repo.stars}` : null]
        .filter(Boolean)
        .join("\n");
      return makeEntry(
        meta,
        (body) => {
          const h3 = el("h3", null, repo.name);
          h3.appendChild(el("span", "arrow", "↗"));
          body.appendChild(h3);
          body.appendChild(
            el("p", null, repoDescription(repo, repo_overrides, state.lang))
          );
          if (repo.topics.length) {
            const tags = el("div", "chip-row");
            repo.topics.forEach((t) => tags.appendChild(el("span", "tag", t)));
            body.appendChild(tags);
          }
        },
        repo.html_url
      );
    })
  );

  updated.textContent = state.updatedAt
    ? `${translate(i18n, "footer_updated", state.lang)}: ${state.updatedAt.slice(0, 10)}`
    : "";
}

function renderLists() {
  const lang = state.lang;

  renderEntrySection("experience", "experience-list", state.content.experience, (x) =>
    makeEntry(x.period, (body) => {
      body.appendChild(el("strong", null, pick(x.title, lang)));
      body.appendChild(el("p", "org", pick(x.org, lang)));
      if (x.summary) body.appendChild(el("p", null, pick(x.summary, lang)));
    })
  );

  renderEntrySection("publications", "publication-list", state.content.publications, (p) =>
    makeEntry(
      p.year,
      (body) => {
        const h3 = el("h3", null, p.title);
        if (p.link) h3.appendChild(el("span", "arrow", "↗"));
        body.appendChild(h3);
        body.appendChild(
          el("p", "org", [p.authors, p.venue].filter(Boolean).join(" · "))
        );
      },
      p.link || null
    )
  );

  renderEntrySection("education", "education-list", state.content.education, (e) =>
    makeEntry(e.period, (body) => {
      body.appendChild(el("strong", null, pick(e.degree, lang)));
      body.appendChild(el("p", "org", pick(e.school, lang)));
    })
  );
}

function renderContact() {
  const { contact } = state.content;
  const build = () => {
    const nodes = [];
    if (contact.email) {
      const a = el("a", "contact-link", contact.email);
      a.href = `mailto:${contact.email}`;
      nodes.push(a);
    }
    contact.links.forEach((l) => {
      const a = el("a", "contact-link", l.label);
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener";
      nodes.push(a);
    });
    return nodes;
  };
  document.getElementById("contact-links").replaceChildren(...build());
  document.getElementById("contact-links-main").replaceChildren(...build());
}

function renderAll() {
  applyStaticText();
  renderSkills();
  renderProjects();
  renderLists();
  renderContact();
}

async function init() {
  state.content = await loadJSON("data/content.json");
  try {
    const data = await loadJSON("data/repos.json");
    state.repos = Array.isArray(data.repos) ? data.repos : null;
    state.updatedAt = data.updated_at;
  } catch (err) {
    console.warn("repos.json unavailable:", err);
    state.repos = null;
  }
  document.getElementById("year").textContent = String(new Date().getFullYear());
  document
    .getElementById("lang-toggle")
    .addEventListener("click", () => setLang(state.lang === "en" ? "ko" : "en"));
  setLang(resolveInitialLang(readStoredLang()));
}
```

주의: `makeEntry`가 만드는 카드는 `<a class="card">`이므로 그 안에 다시 `<a>`를 중첩하면 안 된다 — 프로젝트/논문 제목은 링크 텍스트가 아니라 `<h3>`이고, 카드 전체가 링크다.

`contact-links`(사이드바)와 `contact-links-main`(Contact 섹션) 둘 다 채운다. 같은 DOM 노드를 두 부모에 넣을 수 없으므로 `build()`를 두 번 호출해 각각 새 노드를 만든다.

- [ ] **Step 5: 테스트 + 로컬 렌더 검증**

Run: `node --test`
Expected: PASS 16 (Task 1의 테마 테스트 포함)

Run: `python3 -m http.server 8000 &` 후 브라우저(또는 browse 스킬)로 `http://localhost:8000` 확인:
- 2컬럼 레이아웃, 사이드바가 스크롤에도 고정
- 프로젝트 3장 카드, 경력 4건, 논문 4건, 학력 3건 렌더
- 논문 카드 클릭 시 DOI로 이동, 카드 전체가 링크
- KO 토글 시 한국어 전환 (테마 토글은 아직 동작 안 함 — 정상)
- 900px 미만에서 1컬럼 붕괴, 560px 미만에서 엔트리 1컬럼
- 콘솔 에러 없음

브라우저가 불가하면: `curl -s http://localhost:8000/ | grep -c 'data-i18n'` → `7` 이상, `curl -sI http://localhost:8000/assets/css/style.css | head -1` → `200 OK`. 서버는 검증 후 종료한다.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/css/style.css assets/js/main.js
git commit -m "feat: rebuild page shell with two-column dark layout"
```

---

### Task 3: 테마 토글

**Files:**
- Modify: `assets/js/main.js` (테마 상태·토글 배선 추가)

**Interfaces:**
- Consumes: Task 1의 `resolveInitialTheme(stored) => "dark"|"light"`, Task 2의 `#theme-toggle` 버튼과 `:root[data-theme="light"]` CSS 토큰, 기존 `readStoredLang`/`storeLang` 패턴.
- Produces: `<html data-theme>` 속성이 테마를 반영하고 localStorage 키 `theme`에 저장된다. Task 4는 이 위에 모션만 얹는다.

- [ ] **Step 1: import에 `resolveInitialTheme` 추가**

`assets/js/main.js` 상단 import를 다음으로 바꾼다:

```js
import {
  resolveInitialLang,
  resolveInitialTheme,
  translate,
  repoDescription,
  pick,
} from "./logic.mjs";
```

- [ ] **Step 2: 테마 저장·적용 함수 추가**

`storeLang` 함수 바로 아래에 추가한다:

```js
function readStoredTheme() {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // storage blocked — theme just won't persist
  }
}

function setTheme(theme) {
  state.theme = theme;
  storeTheme(theme);
  document.documentElement.dataset.theme = theme;
  applyToggleLabels();
}
```

`state` 초기값에 `theme`을 추가한다. 기존:

```js
const state = { lang: "en", content: null, repos: null, updatedAt: null };
```

변경 후:

```js
const state = { lang: "en", theme: "dark", content: null, repos: null, updatedAt: null };
```

- [ ] **Step 3: 토글 라벨을 언어·테마 공용 함수로 분리**

`applyStaticText` 안의 언어 토글 라벨 설정 부분(`langToggle.textContent = ...`부터 `);`까지 3줄)을 제거하고, 대신 `applyStaticText` 정의 바로 위에 다음 함수를 추가한다:

```js
function applyToggleLabels() {
  const ko = state.lang === "ko";

  const langToggle = document.getElementById("lang-toggle");
  langToggle.textContent = ko ? "EN" : "KO";
  langToggle.setAttribute("aria-label", ko ? "영어로 전환" : "Switch to Korean");

  const themeToggle = document.getElementById("theme-toggle");
  const toLight = state.theme === "dark";
  themeToggle.textContent = toLight ? "LIGHT" : "DARK";
  themeToggle.setAttribute(
    "aria-label",
    toLight
      ? ko ? "밝은 테마로 전환" : "Switch to light theme"
      : ko ? "어두운 테마로 전환" : "Switch to dark theme"
  );
}
```

그리고 `applyStaticText`의 끝(마지막 줄 `document.getElementById("about-full").textContent = about;` 다음)에 `applyToggleLabels();`를 호출한다. 이렇게 하면 언어를 바꿔도 테마 버튼 라벨이 함께 번역된다.

- [ ] **Step 4: `init`에 테마 배선 추가**

`init` 함수의 `document.getElementById("lang-toggle").addEventListener(...)` 줄 다음에 추가한다:

```js
  document
    .getElementById("theme-toggle")
    .addEventListener("click", () =>
      setTheme(state.theme === "dark" ? "light" : "dark")
    );
  setTheme(resolveInitialTheme(readStoredTheme()));
```

`setTheme` 호출은 `setLang(...)` 호출보다 **앞에** 와야 한다 — `setLang`이 `applyStaticText`를 거쳐 `applyToggleLabels`를 부를 때 `state.theme`이 이미 정해져 있어야 하기 때문이다.

- [ ] **Step 5: 검증**

Run: `node --test`
Expected: PASS 16

로컬 서버에서 확인:
- LIGHT 버튼 클릭 → 라이트 테마로 전환되고 버튼 라벨이 DARK로 바뀜
- 새로고침 후에도 선택한 테마 유지
- KO로 전환하면 테마 버튼 aria-label도 한국어로 바뀜 (개발자 도구에서 확인)
- 라이트 모드에서 액센트 텍스트(`.label`, `.chip`)의 대비가 충분한지 눈으로 확인

- [ ] **Step 6: Commit**

```bash
git add assets/js/main.js
git commit -m "feat: add theme toggle with persistence"
```

---

### Task 4: 모션 레이어

**Files:**
- Modify: `assets/js/main.js` (모션 초기화 추가)
- Modify: `assets/css/style.css` (모션 관련 클래스 추가)

**Interfaces:**
- Consumes: Task 2의 DOM 계약 (`#spotlight`, `.section`, `.side-link[href^="#"]`, `#sidebar`의 `.side-head`/`#side-nav`/`.side-foot`).
- Produces: 최종 페이지. 이후 태스크는 검증·배포만 한다.

- [ ] **Step 1: CSS에 모션 클래스 추가**

`assets/css/style.css`의 `@media (prefers-reduced-motion: reduce)` 블록 **앞에** 추가한다:

```css
/* ── motion ──────────────────────────── */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.reveal.in { opacity: 1; transform: none; }

.stagger { opacity: 0; transform: translateY(18px); animation: rise 0.6s ease forwards; }
.side-head.stagger { animation-delay: 0.05s; }
#side-nav.stagger { animation-delay: 0.13s; }
.side-foot.stagger { animation-delay: 0.21s; }

@keyframes rise { to { opacity: 1; transform: none; } }
```

그리고 기존 `@media (prefers-reduced-motion: reduce)` 블록 안에 다음 규칙을 추가한다:

```css
  .reveal { transition: none; opacity: 1; transform: none; }
  .stagger { animation: none; opacity: 1; transform: none; }
  #spotlight { display: none; }
```

- [ ] **Step 2: main.js에 모션 초기화 함수 추가**

`renderAll` 함수 정의 바로 위에 추가한다:

```js
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function initMotion() {
  if (reduceMotion) return;

  // 로드 스태거 — 사이드바 블록이 순차 등장
  document
    .querySelectorAll("#sidebar .side-head, #sidebar #side-nav, #sidebar .side-foot")
    .forEach((node) => node.classList.add("stagger"));

  // 스크롤 리빌 — 섹션이 뷰포트 진입 시 1회 페이드인
  const sections = [...document.querySelectorAll("main .section")];
  sections.forEach((s) => s.classList.add("reveal"));
  const revealer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          revealer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  sections.forEach((s) => revealer.observe(s));

  // 스크롤 스파이 — 현재 섹션의 사이드 링크 활성화
  const links = [...document.querySelectorAll(".side-link")];
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) =>
          l.classList.toggle("active", l.getAttribute("href") === `#${e.target.id}`)
        );
      });
    },
    { rootMargin: "-40% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));

  // 커서 스포트라이트 — 마우스가 있는 기기에서만
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const spot = document.getElementById("spotlight");
    addEventListener(
      "pointermove",
      (e) => {
        spot.style.setProperty("--mx", `${e.clientX}px`);
        spot.style.setProperty("--my", `${e.clientY}px`);
      },
      { passive: true }
    );
  }
}
```

- [ ] **Step 3: `init`에서 모션 초기화 호출**

`init` 함수의 마지막 줄 `setLang(resolveInitialLang(readStoredLang()));` 다음에 추가한다:

```js
  initMotion();
```

모션 초기화는 렌더링이 끝난 뒤에 와야 한다 — 숨겨진 섹션(빈 데이터)이 확정된 다음에 observer를 붙여야 하기 때문이다.

- [ ] **Step 4: 검증**

Run: `node --test`
Expected: PASS 16

로컬 서버에서 확인:
- 페이지 로드 시 사이드바 3블록이 순차적으로 떠오름
- 스크롤하면 각 섹션이 페이드인하고, 사이드 네비의 현재 항목 선이 길어지며 액센트색으로 바뀜
- 마우스를 움직이면 배경에 은은한 스포트라이트가 따라옴
- 브라우저 개발자 도구에서 `prefers-reduced-motion: reduce`를 에뮬레이션하면 모션이 전부 멈추고 모든 섹션이 즉시 보임 (숨겨지는 섹션 없음)
- 콘솔 에러 없음

- [ ] **Step 5: Commit**

```bash
git add assets/css/style.css assets/js/main.js
git commit -m "feat: add load, scroll, and pointer motion"
```

---

### Task 5: 통합 검증 및 배포

**Files:** 없음 (검증 + 배포)

**Interfaces:**
- Consumes: Task 1–4의 결과물 전체.
- Produces: 라이브 사이트 `https://wf4006hufman.github.io`에 반영된 리디자인.

- [ ] **Step 1: 최종 로컬 점검**

```bash
node --test                              # 16 PASS
git status --porcelain                   # 클린
git log --format='%an <%ae>' b3b2fe7..HEAD | sort -u   # 사용자 identity 단일
```

- [ ] **Step 2: 폭별 오버플로 검사**

로컬 서버에서 375px / 900px / 1440px 세 폭을 확인한다. 각 폭에서:

```js
// 브라우저 콘솔 또는 browse 스킬로 실행
[...document.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 1)
  .map((e) => e.className || e.tagName)
```

Expected: 빈 배열 (`#project-grid` 같은 의도적 스크롤 컨테이너가 잡히면 그것만 허용)

`document.documentElement.scrollWidth === window.innerWidth` 도 각 폭에서 확인한다.

- [ ] **Step 3: 두 테마 × 두 언어 조합 확인**

다크/EN, 다크/KO, 라이트/EN, 라이트/KO 네 조합에서 레이아웃 깨짐과 대비 문제가 없는지 확인한다. 특히 한국어의 긴 기관명(`연세대학교 의과대학 후성유전학·분자과학 연구실`)이 엔트리 본문에서 자연스럽게 줄바꿈되는지 본다.

- [ ] **Step 4: 라이트 테마 대비 계산**

액센트 `#0f766e`가 라이트 배경 `#f4f7fb`와 카드 배경 `#ffffff` 위에서 4.5:1 이상인지 WCAG 상대휘도 공식으로 계산해 수치를 보고한다. 다크 테마의 `#64ffda` on `#0a1628`도 함께 계산한다.

- [ ] **Step 5: 배포**

```bash
git push origin main
```

- [ ] **Step 6: 라이브 확인**

```bash
for i in $(seq 1 24); do
  if curl -s https://wf4006hufman.github.io/assets/css/style.css | grep -q "data-theme"; then break; fi
  sleep 10
done
curl -s -o /dev/null -w 'page: %{http_code}\n' https://wf4006hufman.github.io/
curl -sI https://wf4006hufman.github.io/assets/js/logic.mjs | grep -i content-type
```

Expected: `page: 200`, JavaScript MIME 타입, style.css에 `data-theme` 포함

라이브 페이지에서 Task 4 Step 4의 시각 확인을 한 번 더 수행한다 (로컬과 다른 캐싱 동작이 있을 수 있음).

- [ ] **Step 7: 목업과 대조**

`docs/design/redesign-mockup.html`을 나란히 열어 라이브 페이지와 비교한다. 의도적으로 다른 부분(실제 데이터, 기간 컬럼 폭 9.5rem, Contact 섹션 존재)을 제외하고 시각적으로 어긋난 곳이 있으면 보고한다.

---

## Self-Review 결과

- **Spec coverage:** 다크 기본+라이트 토글(T1·T3), 2컬럼 레이아웃·반응형(T2), 비주얼 토큰(T2 Step 3), 모노 유틸리티 서체(T2 CSS의 `--font-mono` 사용처), tabular-nums(T2 `.entry-meta`), 모션 5종(T4), reduced-motion(T4 Step 1), 접근성(토글 aria-label T3, focus-visible T2, 스파이 선 길이 T2 `.side-link.active::before`, 사이드바 overflow-y T2), 메타 컬럼 9.5rem(T2), 빈 섹션 숨김(기존 `renderEntrySection` 유지), 논문 제목 비번역(T2 `renderLists` — `pick` 미사용), 대비 검증(T5 Step 4), 테스트 회귀(각 태스크), 배포(T5) — 모두 매핑됨.
- **Placeholder scan:** 모든 코드 블록이 실코드. "적절히 처리" 류 없음.
- **Type consistency:** `resolveInitialTheme`(T1→T3), `makeEntry(metaText, buildBody, href)`(T2 내부 일관), `applyToggleLabels`(T3에서 정의·호출), `state.theme`(T3), DOM id/class 계약(T2→T3·T4) 교차 확인 완료. `#publication-list`가 `<ol>`→`<div>`로 바뀐 점과 그에 맞춘 렌더링 변경도 T2 Step 2·4에 함께 반영됨.
