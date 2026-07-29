import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveInitialLang,
  translate,
  repoDescription,
  pick,
} from "../assets/js/logic.mjs";

test("resolveInitialLang: 저장값 우선", () => {
  assert.equal(resolveInitialLang("ko"), "ko");
  assert.equal(resolveInitialLang("en"), "en");
});

test("resolveInitialLang: 저장값 없으면 영어가 기본", () => {
  assert.equal(resolveInitialLang(null), "en");
  assert.equal(resolveInitialLang(undefined), "en");
  assert.equal(resolveInitialLang("garbage"), "en");
});

test("translate: 키 존재 시 해당 언어", () => {
  const i18n = { hello: { en: "Hello", ko: "안녕하세요" } };
  assert.equal(translate(i18n, "hello", "ko"), "안녕하세요");
});

test("translate: 언어 누락 시 en fallback + 경고", () => {
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const i18n = { hello: { en: "Hello" } };
    assert.equal(translate(i18n, "hello", "ko"), "Hello");
    assert.equal(translate(i18n, "missing_key", "en"), "missing_key");
    assert.equal(warnings.length, 2);
  } finally {
    console.warn = orig;
  }
});

test("repoDescription: ko 모드에서 override 우선", () => {
  const repo = { name: "fieldrag", description: "RAG assistant" };
  const overrides = { fieldrag: { description_ko: "RAG 어시스턴트" } };
  assert.equal(repoDescription(repo, overrides, "ko"), "RAG 어시스턴트");
  assert.equal(repoDescription(repo, overrides, "en"), "RAG assistant");
  assert.equal(repoDescription(repo, {}, "ko"), "RAG assistant");
  assert.equal(repoDescription({ name: "x", description: "" }, {}, "en"), "");
});

test("pick: 문자열/이중언어/null 처리", () => {
  assert.equal(pick("plain", "ko"), "plain");
  assert.equal(pick({ en: "Univ", ko: "대학교" }, "ko"), "대학교");
  assert.equal(pick({ en: "Univ" }, "ko"), "Univ");
  assert.equal(pick(null, "en"), "");
});
