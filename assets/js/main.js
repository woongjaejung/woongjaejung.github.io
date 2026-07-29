import {
  resolveInitialLang,
  translate,
  repoDescription,
  pick,
} from "./logic.mjs";

const state = { lang: "en", content: null, repos: null, updatedAt: null };

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function applyStaticText() {
  const { i18n } = state.content;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translate(i18n, node.dataset.i18n, state.lang);
  });
  document.documentElement.lang = state.lang;
  const toggle = document.getElementById("lang-toggle");
  toggle.textContent = state.lang === "en" ? "KO" : "EN";
  toggle.setAttribute(
    "aria-label",
    state.lang === "en" ? "Switch to Korean" : "영어로 전환"
  );

  const { profile } = state.content;
  document.getElementById("hero-name").textContent = profile.name;
  document.getElementById("hero-tagline").textContent = pick(
    profile.tagline,
    state.lang
  );
  document.getElementById("about-text").textContent = pick(
    profile.about,
    state.lang
  );
}

function renderSkills() {
  const wrap = document.getElementById("skill-list");
  wrap.replaceChildren(
    ...state.content.skills.map((s) => el("span", "skill-chip", s))
  );
}

function renderProjects() {
  const grid = document.getElementById("project-grid");
  const updated = document.getElementById("projects-updated");
  const { i18n, repo_overrides } = state.content;

  if (!state.repos) {
    const fallback = el("p", "muted", translate(i18n, "projects_fallback", state.lang) + " ");
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
      const card = el("article", "card");
      const title = el("h3");
      const link = el("a", null, repo.name);
      link.href = repo.html_url;
      link.target = "_blank";
      link.rel = "noopener";
      title.appendChild(link);
      card.appendChild(title);
      card.appendChild(
        el("p", null, repoDescription(repo, repo_overrides, state.lang))
      );
      const meta = el("div", "card-meta");
      if (repo.language) meta.appendChild(el("span", "lang-dot", repo.language));
      if (repo.stars > 0) meta.appendChild(el("span", null, `★ ${repo.stars}`));
      card.appendChild(meta);
      if (repo.topics.length) {
        const tags = el("div", "chip-row");
        repo.topics.forEach((t) => tags.appendChild(el("span", "tag", t)));
        card.appendChild(tags);
      }
      return card;
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

  renderEntrySection("experience", "experience-list", state.content.experience, (x) => {
    const entry = el("div", "entry");
    entry.appendChild(el("span", "entry-period", x.period));
    const body = el("div");
    body.appendChild(el("strong", null, pick(x.title, lang)));
    body.appendChild(el("div", "muted", pick(x.org, lang)));
    if (x.summary) body.appendChild(el("p", "small", pick(x.summary, lang)));
    entry.appendChild(body);
    return entry;
  });

  renderEntrySection("publications", "publication-list", state.content.publications, (p) => {
    const li = el("li", "entry");
    if (p.link) {
      const a = el("a", null, p.title);
      a.href = p.link;
      a.target = "_blank";
      a.rel = "noopener";
      li.appendChild(a);
    } else {
      li.appendChild(el("span", null, p.title));
    }
    li.appendChild(el("div", "muted small", [p.authors, p.venue, p.year].filter(Boolean).join(" · ")));
    return li;
  });

  renderEntrySection("education", "education-list", state.content.education, (e) => {
    const entry = el("div", "entry");
    entry.appendChild(el("span", "entry-period", e.period));
    const body = el("div");
    body.appendChild(el("strong", null, pick(e.degree, lang)));
    body.appendChild(el("div", "muted", pick(e.school, lang)));
    entry.appendChild(body);
    return entry;
  });
}

function renderContact() {
  const wrap = document.getElementById("contact-links");
  const { contact } = state.content;
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
  wrap.replaceChildren(...nodes);
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
