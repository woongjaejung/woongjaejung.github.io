export function transformRepos(apiRepos, { excludeRepos = [] } = {}) {
  return apiRepos
    .filter((r) => !r.fork && !excludeRepos.includes(r.name))
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      language: r.language ?? null,
      topics: r.topics ?? [],
      stars: r.stargazers_count ?? 0,
      pushed_at: r.pushed_at,
      html_url: r.html_url,
    }))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
}

export function assertValidRepos(repos) {
  if (!Array.isArray(repos) || repos.length === 0) {
    throw new Error("repos is empty — refusing to overwrite data/repos.json");
  }
  for (const r of repos) {
    if (!r.name || !r.html_url) {
      throw new Error(`invalid repo entry: ${JSON.stringify(r)}`);
    }
  }
}
