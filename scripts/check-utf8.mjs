// scripts/check-utf8.mjs — UTF-8 + known-typo gate (pure node, no deps).
//
// (a) Strict-decodes every tracked text file (TextDecoder fatal:true).
// (b) Denylists known Vietnamese diacritic typos in display code + seed JSON.
// Exit 0 = pass, 1 = fail (prints offending file + line).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

// Binary extensions are never decoded as text.
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.mp3', '.mp4', '.webm',
]);

// Denylist: [regex, scope-prefixes]. Scopes keep the rule tight so
// legitimate words elsewhere (e.g. "Goóc-ba-chốp", "xốp", "lốp xe") never trip it.
const DENYLIST = [
  { re: /nốp/, scopes: ['components/', 'app/', 'lib/', 'data/'] },
  { re: /Õn/, scopes: ['components/', 'app/', 'lib/', 'data/'] },
];

// data/ scope is seed JSON only — legacy data/*.js is out of scope.
function inScope(file, scopes) {
  if (!scopes.some((s) => file.startsWith(s))) return false;
  if (file.startsWith('data/')) return file.endsWith('.json');
  return true;
}

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const decoder = new TextDecoder('utf-8', { fatal: true });
let failures = 0;

// (a) strict UTF-8 decode of every tracked non-binary file
for (const file of tracked) {
  if (BINARY_EXT.has(extname(file).toLowerCase())) continue;
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue; // deleted after ls-files (e.g. concurrent switch) — ignore
  }
  try {
    decoder.decode(buf);
  } catch {
    console.error(`NOT-UTF8: ${file}`);
    failures++;
  }
}

// (b) denylist scan
for (const file of tracked) {
  const rule = DENYLIST.find((d) => inScope(file, d.scopes));
  if (!rule) continue;
  if (BINARY_EXT.has(extname(file).toLowerCase())) continue;
  let text;
  try {
    text = readFileSync(join(process.cwd(), file), 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    const m = rule.re.exec(line);
    if (m) {
      console.error(`TYPO ${file}:${i + 1}: ...${line.trim().slice(0, 80)}...`);
      failures++;
    }
  });
}

if (failures > 0) {
  console.error(`check-utf8: FAIL (${failures} problem(s))`);
  process.exit(1);
}
console.log('check-utf8: PASS');
