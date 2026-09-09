import {
  resolveInitialLang, resolveInitialTheme, resolveInitialView, translate, pick, VIEWS,
} from "./logic.mjs";

export const state = {
  lang: "en", theme: "dark", view: "browser", content: null, repos: null, updatedAt: null, now: new Date(),
};

const listeners = [];
export function onLang(fn) { listeners.push(fn); }

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function t(key, vars) {
  let s = translate(state.content?.i18n, key, state.lang);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
export function pk(field) { return pick(field, state.lang); }
export function viewHref(view) { return { browser: "index.html", run: "run.html", classic: "classic.html" }[view]; }

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function setTheme(theme, persist = true) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) write("theme", theme);
  renderToggleLabels();
}

export function setLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  write("lang", lang);
  renderTopbarText();
  listeners.forEach((fn) => fn());
}

function renderToggleLabels() {
  const ko = state.lang === "ko";
  const lt = document.getElementById("lang-toggle");
  if (lt) { lt.textContent = ko ? "EN" : "KO"; lt.setAttribute("aria-label", ko ? "영어로 전환" : "Switch to Korean"); }
  const tt = document.getElementById("theme-toggle");
  if (tt) {
    const toLight = state.theme === "dark";
    tt.textContent = toLight ? "LIGHT" : "DARK";
    tt.setAttribute("aria-label", toLight ? (ko ? "밝은 테마로 전환" : "Switch to light theme") : (ko ? "어두운 테마로 전환" : "Switch to dark theme"));
  }
}

function renderTopbarText() {
  document.querySelectorAll("#topbar .views a").forEach((a) => { a.textContent = t(`view_${a.dataset.view}`); });
  const form = document.getElementById("locus-form");
  if (form) { form.querySelector("label").textContent = t("locus_label"); form.querySelector("button").textContent = t("locus_go"); }
  const hint = document.getElementById("hintbar");
  if (hint) { hint.querySelector("span").textContent = t("view_hint"); hint.querySelector("button").textContent = t("view_hint_close"); }
  renderToggleLabels();
}

function renderTopbar({ view, showLocus, showTheme }) {
  const bar = document.getElementById("topbar");
  const brand = el("a", "brand", "jae.genome ");
  brand.href = "index.html?view=browser"; // never bounce through the stored-view redirect
  const buildLabel = el("small", null, state.updatedAt ? `hg-jae · build ${state.updatedAt.slice(0, 7).replace("-", ".")}` : "hg-jae");
  buildLabel.id = "build-label";
  brand.appendChild(buildLabel);
  const views = el("nav", "views");
  views.setAttribute("aria-label", "View");
  for (const v of VIEWS) {
    const a = el("a", null, "");
    a.dataset.view = v;
    a.href = v === "browser" ? "index.html?view=browser" : viewHref(v);
    if (v === view) a.setAttribute("aria-current", "page");
    a.addEventListener("click", () => write("view", v));
    views.appendChild(a);
  }
  const form = el("form", "locus");
  form.id = "locus-form";
  form.hidden = !showLocus;
  const label = el("label"); label.htmlFor = "locus";
  const input = el("input"); input.id = "locus"; input.value = "chrCareer";
  const go = el("button", "go"); go.type = "submit";
  form.append(label, input, go);
  const lt = el("button", "tb-toggle"); lt.id = "lang-toggle"; lt.type = "button";
  lt.addEventListener("click", () => setLang(state.lang === "en" ? "ko" : "en"));
  const tt = el("button", "tb-toggle"); tt.id = "theme-toggle"; tt.type = "button";
  tt.hidden = !showTheme;
  tt.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  bar.replaceChildren(brand, views, form, lt, tt);

  const hint = el("div", "hintbar"); hint.id = "hintbar";
  hint.hidden = read("view-hint-seen") === "1" || view !== "browser";
  const close = el("button"); close.type = "button";
  close.addEventListener("click", () => { hint.hidden = true; write("view-hint-seen", "1"); });
  hint.append(el("span"), close);
  bar.after(hint);
}

function syncTopbarHeight() {
  const bar = document.getElementById("topbar");
  if (bar) document.documentElement.style.setProperty("--topbar-h", `${bar.offsetHeight}px`);
}

export async function boot({ view, themeFallback = "dark", showLocus = false, showTheme = true }) {
  state.view = view;
  if (view === "browser") {
    const wanted = resolveInitialView(read("view"), location.search);
    // redirecting: content stays null — callers must check state.content before rendering
    if (wanted !== "browser") { location.replace(viewHref(wanted)); return state; }
  }
  setTheme(resolveInitialTheme(read("theme"), themeFallback), showTheme);
  state.content = await loadJSON("data/content.json");
  try {
    const data = await loadJSON("data/repos.json");
    state.repos = Array.isArray(data.repos) ? data.repos.filter((r) => !(state.content.exclude_repos || []).includes(r.name)) : null;
    state.updatedAt = data.updated_at;
  } catch (err) {
    console.warn("repos.json unavailable:", err);
    state.repos = null;
  }
  renderTopbar({ view, showLocus, showTheme });
  state.lang = resolveInitialLang(read("lang"));
  document.documentElement.lang = state.lang;
  renderTopbarText();
  syncTopbarHeight();
  window.addEventListener("resize", syncTopbarHeight);
  return state;
}

export function showLoadError() {
  document.body.appendChild(el("p", "load-error",
    "Failed to load page data. Please refresh. / 페이지 데이터를 불러오지 못했습니다. 새로고침해 주세요."));
}
