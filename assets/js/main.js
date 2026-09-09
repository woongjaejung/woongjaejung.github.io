import {
  resolveInitialLang,
  resolveInitialTheme,
  translate,
  repoDescription,
  pick,
  normalizeSkills,
} from "./logic.mjs";

const state = { lang: "en", theme: "dark", content: null, repos: null, updatedAt: null };

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function readStoredLang() {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
}

function storeLang(lang) {
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // storage blocked (e.g. private mode) — ignore, lang just won't persist
  }
}

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

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

function applyStaticText() {
  const { i18n, profile } = state.content;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translate(i18n, node.dataset.i18n, state.lang);
  });
  document.documentElement.lang = state.lang;

  document.getElementById("hero-name").textContent = profile.name;
  document.getElementById("hero-tagline").textContent = pick(profile.tagline, state.lang);

  const about = pick(profile.about, state.lang);
  document.getElementById("about-text").textContent =
    pick(profile.intro, state.lang) || about;
  document.getElementById("about-full").textContent = about;
  applyToggleLabels();
}

function renderSkills() {
  const wrap = document.getElementById("skill-list");
  wrap.replaceChildren(
    ...normalizeSkills(state.content.skills).map((s) => el("span", "skill-chip", s.name))
  );
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
    const link = el("a", null, "github.com/woongjaejung");
    link.href = "https://github.com/woongjaejung";
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

function renderEntrySection(sectionId, listId, items, build) {
  const section = document.getElementById(sectionId);
  const navLink = document.querySelector(`[data-section-link="${sectionId}"]`);
  const empty = !items || items.length === 0;
  section.hidden = empty;
  if (navLink) navLink.hidden = empty;
  if (empty) return;
  document.getElementById(listId).replaceChildren(...items.map(build));
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

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function initMotion() {
  if (reduceMotion) return;

  // 로드 스태거 — 플로팅 내비게이션이 위에서 떨어지며 등장
  document.getElementById("site-nav")?.classList.add("stagger");

  // 스크롤 리빌 — 벤토 카드가 뷰포트 진입 시 1회 페이드인 (--d로 스태거)
  const cards = [...document.querySelectorAll("main .bento-card")];
  cards.forEach((c) => c.classList.add("reveal"));
  const revealer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          revealer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  cards.forEach((c) => revealer.observe(c));

  // 스크롤 스파이 — 현재 섹션의 내비 링크 활성화 (링크가 있는 카드만 관찰)
  const links = [...document.querySelectorAll(".side-link")];
  const spied = cards.filter((c) =>
    links.some((l) => l.getAttribute("href") === `#${c.id}`)
  );
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
  spied.forEach((s) => spy.observe(s));

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

function renderAll() {
  applyStaticText();
  renderSkills();
  renderProjects();
  renderLists();
  renderContact();
}

function setLang(lang) {
  state.lang = lang;
  storeLang(lang);
  renderAll();
}

async function init() {
  document
    .getElementById("lang-toggle")
    .addEventListener("click", () => setLang(state.lang === "en" ? "ko" : "en"));
  document
    .getElementById("theme-toggle")
    .addEventListener("click", () =>
      setTheme(state.theme === "dark" ? "light" : "dark")
    );
  document.querySelectorAll(".view-link").forEach((a) =>
    a.addEventListener("click", () => {
      try { localStorage.setItem("view", a.dataset.view); } catch { /* ignore */ }
    })
  );
  setTheme(resolveInitialTheme(readStoredTheme()));

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
  setLang(resolveInitialLang(readStoredLang()));
  initMotion();
}

init().catch((err) => {
  console.error(err);
  document.body.appendChild(
    el(
      "p",
      "muted",
      "Failed to load page data. Please refresh. / 페이지 데이터를 불러오지 못했습니다. 새로고침해 주세요."
    )
  );
});
