import { readFile, writeFile, mkdir } from "node:fs/promises";
import { transformRepos, assertValidRepos } from "./transform.mjs";

const USER = "wf4006hufman";
const OUT = new URL("../data/repos.json", import.meta.url);
const CONTENT = new URL("../data/content.json", import.meta.url);

async function loadExcludes() {
  try {
    const content = JSON.parse(await readFile(CONTENT, "utf8"));
    return content.exclude_repos ?? [];
  } catch {
    return [];
  }
}

async function fetchAllRepos() {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(
    `https://api.github.com/users/${USER}/repos?per_page=100&type=owner`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const excludeRepos = await loadExcludes();
const repos = transformRepos(await fetchAllRepos(), { excludeRepos });
assertValidRepos(repos);

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({ updated_at: new Date().toISOString(), repos }, null, 2) + "\n"
);
console.log(`wrote ${repos.length} repos to data/repos.json`);
