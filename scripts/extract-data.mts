/*
 * Extract structured JSON from the legacy `data/*.js` global-variable files.
 *
 * These files set globals via `window.QBANK.push(...)`, `window.PASSAGES[id]={...}`,
 * `window.THEORY = {...}` etc. We eval each file in a single shared `vm` sandbox
 * that stubs `window`, then read the accumulated globals and write JSON.
 *
 * IMPORTANT: eval order must match `index.html` script-tag order. In particular
 * `theory.js` does a full `window.THEORY = {...}` assignment (history/biology/chemistry)
 * while `english-theory.js` does `window.THEORY = window.THEORY || {}; window.THEORY.english = {...}`.
 * If english-theory ran first, theory.js would wipe the english slice — so we follow
 * the real browser load order.
 *
 * Question pool dedup matches app.js line 26: key = (passageId||"") + question.trim().toLowerCase().
 * The app.js validity filter (line 24) is also applied so `questions.json` equals the app's
 * usable question set (the "748 câu hỏi" the README advertises).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const dataDir = path.join(root, "data");

function listDataFiles(): string[] {
  const htmlPath = path.join(root, "index.html");
  if (!fs.existsSync(htmlPath)) throw new Error("index.html not found");
  const html = fs.readFileSync(htmlPath, "utf8");
  // Match <script src="data/FILE.js"> in document order.
  return [...html.matchAll(/<script\s+src="data\/([^"]+\.js)">/g)].map((m) => m[1]);
}

function makeSandbox() {
  const sandbox: Record<string, unknown> = {};
  // Files reference `window`; make window === sandbox so globals accumulate in one place.
  sandbox.window = sandbox;
  // Some files (none known) may reference `document`/`console`; stub defensively.
  sandbox.console = console;
  return vm.createContext(sandbox);
}

function isValidQuestion(q: any): boolean {
  if (!(q && q.id && q.question && q.explanation)) return false;
  const hasMc = q.options && q.options.length === 4 && q.correctAnswer >= 0 && q.correctAnswer < 4;
  const hasTf = q.type === "true_false" && q.statements && q.statements.length === 4;
  return hasMc || hasTf;
}

function main() {
  const files = listDataFiles();
  console.log("Load order from index.html:");
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

  const ctx = makeSandbox();
  for (const file of files) {
    const src = fs.readFileSync(path.join(dataDir, file), "utf8");
    vm.runInContext(src, ctx, { filename: file });
  }

  const w = ctx.window as any;
  const rawQBANK: any[] = (w.QBANK || []).slice();

  // app.js line 24 validity filter
  const validQBANK = rawQBANK.filter(isValidQuestion);

  // app.js line 26 dedup: key = (passageId||"") + question.trim().toLowerCase()
  const seen = new Set<string>();
  const questions = validQBANK.filter((q) => {
    const key = (q.passageId || "") + q.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // PASSAGES: object map { passageId: { title, text } } — already keyed correctly (edge case handled).
  const passages: Record<string, { title: string; text: string }> = w.PASSAGES || {};

  // THEORY: full set { subject: { lesson: { title, desc, html } } } — includes english
  // (verification expects history(3)+biology(3)+chemistry(2)+english(2)).
  const theory = w.THEORY || {};

  // English theory is the english slice, exposed separately.
  const englishTheory = w.THEORY?.english || {};

  // VOCAB: { unit: [{ en, vi, pos, ipa, kind }] }
  const vocab = w.VOCAB || {};

  const out = (file: string, data: unknown) =>
    fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2) + "\n");

  out("questions.json", questions);
  out("passages.json", passages);
  out("theory.json", theory);
  out("english-theory.json", englishTheory);
  out("vocab.json", vocab);

  console.log("\n--- Counts ---");
  console.log("raw QBANK entries:    ", rawQBANK.length);
  console.log("after validity filter:", validQBANK.length);
  console.log("after dedup (final): ", questions.length);
  console.log("passages:            ", Object.keys(passages).length);
  console.log("theory subjects:     ", Object.keys(theory));
  console.log("  - history lessons:  ", Object.keys(theory.history || {}).length);
  console.log("  - biology lessons:  ", Object.keys(theory.biology || {}).length);
  console.log("  - chemistry lessons:", Object.keys(theory.chemistry || {}).length);
  console.log("  - english lessons:  ", Object.keys(theory.english || {}).length);
  console.log("english-theory units: ", Object.keys(englishTheory).length);
  console.log("vocab units:         ", Object.keys(vocab).length);
}

main();
