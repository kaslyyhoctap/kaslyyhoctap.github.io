// Validator fail-fast cho bank Vật lí 12 — không dep mới. `node scripts/validate-physics.mjs`
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const errors = [];
const fail = (m) => errors.push(m);

function loadBank() {
  const files = readdirSync(dataDir).filter((f) => /^physics-.*\.js$/.test(f)).sort();
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
const phy = qs.filter((q) => q.subject === "physics");
const byLesson = (l) => phy.filter((q) => q.lesson === l);
const byType = (arr, t) => arr.filter((q) => (q.type || "multiple_choice") === t);

// 1. Mỗi đề = 28 câu: 18 MC / 4 TF / 6 SA
const EXPECT = { 1: 18, 2: 18, 3: 18, 4: 18, 5: 18 };
for (const l of Object.keys(EXPECT).map(Number)) {
  const arr = byLesson(l);
  if (arr.length !== 28) fail(`Đề ${l}: có ${arr.length} câu, cần 28`);
  if (byType(arr, "multiple_choice").length !== EXPECT[l]) fail(`Đề ${l}: MC=${byType(arr, "multiple_choice").length}, cần ${EXPECT[l]}`);
  if (byType(arr, "true_false").length !== 4) fail(`Đề ${l}: TF=${byType(arr, "true_false").length}, cần 4`);
  if (byType(arr, "short_answer").length !== 6) fail(`Đề ${l}: SA=${byType(arr, "short_answer").length}, cần 6`);
}

// 2. Id convention phy{N}-{mc|tf|sa}-NN, duy nhất
const ids = new Set();
for (const q of phy) {
  const m = /^phy([1-5])-(mc|tf|sa)-(\d{2})$/.exec(q.id || "");
  if (!m) fail(`ID sai convention: ${q.id}`);
  else if (Number(m[1]) !== q.lesson) fail(`ID ${q.id} lệch lesson ${q.lesson}`);
  else if ((m[2] === "mc") !== ((q.type || "multiple_choice") === "multiple_choice")) fail(`ID ${q.id} lệch dạng bài`);
  if (ids.has(q.id)) fail(`ID trùng: ${q.id}`);
  ids.add(q.id);
}

// 3. Đủ trường bắt buộc (app.js lọc âm thầm nếu thiếu)
for (const q of phy) {
  if (!q.question || !q.explanation || !q.topic || !q.difficulty || !q.source) fail(`${q.id}: thiếu question/explanation/topic/difficulty/source`);
  if (q.type === "true_false") {
    if (!Array.isArray(q.statements) || q.statements.length !== 4 || !q.statements.every((s) => s && typeof s.t === "string" && typeof s.ok === "boolean"))
      fail(`${q.id}: statements phải là 4 mục {t, ok}`);
  } else if (q.type === "short_answer") {
    if (typeof q.answer !== "string" || q.answer === "" || isNaN(parseFloat(q.answer))) fail(`${q.id}: answer không hợp lệ: ${q.answer}`);
    if (q.maxLen && q.answer.length > q.maxLen) fail(`${q.id}: answer dài hơn maxLen`);
  } else {
    if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${q.id}: options phải có 4 phần tử`);
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3) fail(`${q.id}: correctAnswer ngoài 0..3`);
  }
}

// 4. Không trùng câu hỏi
const seen = new Set();
for (const q of phy) {
  const k = (q.passageId || "") + (q.question || "").trim().toLowerCase();
  if (seen.has(k)) fail(`Câu hỏi trùng: ${q.id}`);
  seen.add(k);
}

// 5. Spread đáp án MC: ≤35% với đề biên soạn (3-5), ≤50% với đề gốc (1-2)
for (const l of [1, 2, 3, 4, 5]) {
  const cap = l >= 3 ? 0.35 : 0.5;
  const cnt = [0, 0, 0, 0];
  for (const q of byType(byLesson(l), "multiple_choice")) cnt[q.correctAnswer]++;
  const n = byType(byLesson(l), "multiple_choice").length;
  for (let i = 0; i < 4; i++) {
    if (cnt[i] / n > cap) fail(`Đề ${l}: đáp án ${"ABCD"[i]} chiếm ${cnt[i]}/${n} > ${cap * 100}%`);
  }
}

if (errors.length) {
  console.error("FAIL " + files.length + " file, " + errors.length + " lỗi:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`PASS: ${files.length} file physics, ${phy.length} câu (5 đề × 28: 18 MC / 4 TF / 6 SA)`);
