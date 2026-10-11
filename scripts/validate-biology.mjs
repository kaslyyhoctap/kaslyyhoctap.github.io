// Validator fail-fast cho bank Sinh 12 — không dep mới. `node scripts/validate-biology.mjs`
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const errors = [];
const reviews = [];
const fail = (m) => errors.push(m);
const review = (m) => reviews.push(m);

function loadBank() {
  const files = readdirSync(dataDir).filter((f) => /^biology-.*\.js$/.test(f)).sort();
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of files) {
    const code = readFileSync(join(dataDir, f), "utf8");
    try {
      vm.runInContext(code + `\n//# sourceURL=${f}`, sandbox, { filename: f });
    } catch (e) {
      fail(`LOAD ${f}: ${e.message}`);
    }
  }
  return { files, qs: sandbox.window.QBANK || [] };
}

const { files, qs } = loadBank();
const bio = qs.filter((q) => q.subject === "biology");
const byLesson = (l) => bio.filter((q) => q.lesson === l);
const byType = (arr, t) => arr.filter((q) => (q.type || "multiple_choice") === t);

// 1. Count: Bài 1/2 = 100 (40 MC / 30 TF / 30 SA); Bài 4 = 110 (50 MC / 30 TF / 30 SA, gồm 10 MC bệnh di truyền)
const EXPECT = { 1: { t: 100, mc: 40, tf: 30, sa: 30 }, 2: { t: 100, mc: 40, tf: 30, sa: 30 }, 4: { t: 110, mc: 50, tf: 30, sa: 30 } };
for (const l of [1, 2, 4]) {
  const arr = byLesson(l);
  const e = EXPECT[l];
  if (arr.length !== e.t) fail(`Bài ${l}: có ${arr.length} câu, cần ${e.t}`);
  const mc = byType(arr, "multiple_choice").length;
  const tf = byType(arr, "true_false").length;
  const sa = byType(arr, "short_answer").length;
  if (mc !== e.mc) fail(`Bài ${l}: MC=${mc}, cần ${e.mc}`);
  if (tf !== e.tf) fail(`Bài ${l}: TF=${tf}, cần ${e.tf}`);
  if (sa !== e.sa) fail(`Bài ${l}: SA=${sa}, cần ${e.sa}`);
}
// 2. CD1 lesson 5: 40 câu
{
  const arr = byLesson(5);
  if (arr.length !== 40) fail(`CD1 lesson 5: có ${arr.length} câu, cần 40`);
}

// 3. Schema từng câu
const seenQ = new Map();
for (const q of bio) {
  const tag = q.id || "(no-id)";
  if (!q.id || !q.subject || q.lesson == null || !q.topic || !q.question || !q.difficulty) fail(`${tag}: thiếu id/subject/lesson/topic/question/difficulty`);
  if (q.subject !== "biology") fail(`${tag}: subject=${q.subject}`);
  if (!["multiple_choice", "true_false", "short_answer"].includes(q.type)) fail(`${tag}: type=${q.type} thiếu/sai`);
  if (!q.explanation) fail(`${tag}: thiếu explanation`);
  if (!q.source) fail(`${tag}: thiếu source`);
  else if (!/imgs\/|SGK|Chuy.n .|Nguy.n Hu|Nguồn/i.test(q.source)) review(`${tag}: source thiếu trace ảnh: ${q.source}`);
  if (q.sourceUrl == null) fail(`${tag}: thiếu sourceUrl`);
  const key = (q.question || "").trim();
  if (seenQ.has(key)) fail(`${tag}: trùng question với ${seenQ.get(key)}`);
  else if (key) seenQ.set(key, tag);

  if (q.type === "multiple_choice") {
    if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${tag}: options cần 4`);
    else if (new Set(q.options.map((o) => String(o).trim())).size !== 4) fail(`${tag}: options trùng nhau`);
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3) fail(`${tag}: correctAnswer=${q.correctAnswer}`);
  }
  if (q.type === "true_false") {
    if (!Array.isArray(q.statements) || q.statements.length !== 4) fail(`${tag}: statements cần 4`);
    else {
      const oks = q.statements.filter((s) => s.ok === true).length;
      if (oks === 0 || oks === 4) fail(`${tag}: TF toàn Đúng/Sai (${oks}/4)`);
      for (const s of q.statements) if (typeof s.t !== "string" || typeof s.ok !== "boolean") fail(`${tag}: statement sai schema {t, ok}`);
    }
  }
  if (q.type === "short_answer") {
    if (typeof q.answer !== "string" || !/^[0-9]{1,4}$/.test(q.answer)) fail(`${tag}: SA answer phải digits-only 1-4 ký tự, got ${JSON.stringify(q.answer)}`);
    if (q.maxLen !== String(q.answer || "").length && q.maxLen !== Number(String(q.answer || "").length)) {
      if (Number(q.maxLen) > 4) fail(`${tag}: SA maxLen=${q.maxLen} > 4`);
    }
    if (q.alts && q.alts.some((a) => /[a-zA-ZÀ-ỹ]/.test(String(a)))) fail(`${tag}: SA alts chứa chữ`);
  }
}

// 4. ID convention
for (const q of bio) {
  if (q.lesson === 5) {
    if (!/^biocd1-\d{2}$/.test(q.id || "")) fail(`${q.id}: CD1 id phải biocd1-NN`);
  } else if ([1, 2, 4].includes(q.lesson)) {
    if (!new RegExp(`^bio${q.lesson}-(mc|tf|sa)-\\d{2}$`).test(q.id || "")) fail(`${q.id}: id phải bio${q.lesson}-(mc|tf|sa)-NN`);
  }
}

// 5. MC phân bố đáp án ≤35%/vị trí (từng bài)
for (const l of [1, 2, 4]) {
  const mcs = byType(byLesson(l), "multiple_choice");
  if (mcs.length) {
    const cnt = [0, 0, 0, 0];
    for (const q of mcs) if (q.correctAnswer >= 0 && q.correctAnswer <= 3) cnt[q.correctAnswer]++;
    cnt.forEach((c, i) => {
      if (c / mcs.length > 0.35) fail(`Bài ${l}: đáp án ${"ABCD"[i]}=${c}/${mcs.length} quá 35%`);
    });
  }
}

// 6. Theory có biology 1/2/4/5 + dòng Nguồn
{
  const th = join(dataDir, "theory.js");
  if (!existsSync(th)) fail("thiếu data/theory.js");
  else {
    const txt = readFileSync(th, "utf8");
    for (const k of ["1:", "2:", "4:"]) {
      if (!txt.includes(k)) review(`theory.js thiếu key biology[${k}]`);
    }
    if (!/5:\s*\{/.test(txt)) fail("theory.js thiếu biology[5]");
    if (!/Nguồn:/.test(txt)) fail("theory.js thiếu dòng trace Nguồn:");
  }
}

// 7. index.html wire-up
{
  const idx = join(root, "index.html");
  const txt = readFileSync(idx, "utf8");
  if (/biology-bai[124][bc]\.js/.test(txt)) fail("index.html còn script thừa *b/*c");
  if (!txt.includes("data/biology-cd1.js")) fail("index.html chưa wire biology-cd1.js");
}

if (reviews.length) {
  console.log("needs_review:");
  for (const r of reviews) console.log(" - " + r);
}
if (errors.length) {
  console.error(`FAIL ${errors.length} lỗi:`);
  for (const e of errors) console.error(" - " + e);
  process.exit(1);
}
console.log(`PASS: biology Bài 1/2/4 = ${byLesson(1).length}/${byLesson(2).length}/${byLesson(4).length}, CD1 lesson5 = ${byLesson(5).length}, files: ${files.join(",")}`);
