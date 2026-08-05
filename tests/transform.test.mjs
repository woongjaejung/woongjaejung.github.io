import { test } from "node:test";
import assert from "node:assert/strict";
import { transformRepos, assertValidRepos } from "../scripts/transform.mjs";

const apiRepo = (over = {}) => ({
  name: "fieldrag",
  description: "Grounded RAG assistant",
  language: "Python",
  topics: ["rag"],
  stargazers_count: 3,
  pushed_at: "2026-07-05T00:00:00Z",
  html_url: "https://github.com/woongjaejung/fieldrag",
  fork: false,
  extra_api_field: "must be dropped",
  ...over,
});

test("fork는 제외한다", () => {
  const out = transformRepos([apiRepo(), apiRepo({ name: "f2", fork: true })]);
  assert.deepEqual(out.map((r) => r.name), ["fieldrag"]);
});

test("excludeRepos 목록의 repo는 제외한다", () => {
  const out = transformRepos([apiRepo(), apiRepo({ name: "webflyx" })], {
    excludeRepos: ["webflyx"],
  });
  assert.deepEqual(out.map((r) => r.name), ["fieldrag"]);
});

test("허용된 필드만 추출한다", () => {
  const [r] = transformRepos([apiRepo()]);
  assert.deepEqual(r, {
    name: "fieldrag",
    description: "Grounded RAG assistant",
    language: "Python",
    topics: ["rag"],
    stars: 3,
    pushed_at: "2026-07-05T00:00:00Z",
    html_url: "https://github.com/woongjaejung/fieldrag",
  });
});

test("null 설명·언어·topics를 기본값으로 채운다", () => {
  const [r] = transformRepos([
    apiRepo({ description: null, language: null, topics: undefined }),
  ]);
  assert.equal(r.description, "");
  assert.equal(r.language, null);
  assert.deepEqual(r.topics, []);
});

test("pushed_at 내림차순 정렬", () => {
  const out = transformRepos([
    apiRepo({ name: "old", pushed_at: "2025-01-01T00:00:00Z" }),
    apiRepo({ name: "new", pushed_at: "2026-07-01T00:00:00Z" }),
  ]);
  assert.deepEqual(out.map((r) => r.name), ["new", "old"]);
});

test("assertValidRepos: 빈 배열이면 throw", () => {
  assert.throws(() => assertValidRepos([]), /empty/i);
});

test("assertValidRepos: 필수 필드 누락 시 throw", () => {
  assert.throws(() => assertValidRepos([{ name: "" }]), /invalid/i);
});

test("assertValidRepos: 정상 배열은 통과", () => {
  assert.doesNotThrow(() =>
    assertValidRepos(transformRepos([apiRepo()]))
  );
});
