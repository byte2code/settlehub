// Copies the OCR engine and English model into public/ocr so receipt scanning is served from our own site
// (no third-party CDN, works offline once cached). Runs after `npm install`; the output is gitignored.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');

const files = [
  [join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js')],
  [join(nm, 'tesseract.js-core', 'tesseract-core-lstm.wasm.js'), join(out, 'tesseract-core-lstm.wasm.js')],
  [join(nm, 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), join(out, 'tesseract-core-simd-lstm.wasm.js')],
  [join(nm, 'tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), join(out, 'tesseract-core-relaxedsimd-lstm.wasm.js')],
];

if (!existsSync(join(nm, 'tesseract.js'))) {
  console.log('[ocr] tesseract.js not installed, skipping asset copy');
  process.exit(0);
}
mkdirSync(join(out, 'lang'), { recursive: true });
for (const [from, to] of files) {
  if (existsSync(from)) cpSync(from, to);
  else console.warn(`[ocr] missing ${from}`);
}
// The model ships UNCOMPRESSED on purpose: Android's asset packaging unpacks *.gz files and drops the extension, so a
// "eng.traineddata.gz" request 404s inside the APK. (Web hosts compress it in transit anyway.)
const model = join(nm, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz');
if (existsSync(model)) {
  writeFileSync(join(out, 'lang', 'eng.traineddata'), gunzipSync(readFileSync(model)));
  rmSync(join(out, 'lang', 'eng.traineddata.gz'), { force: true });
} else console.warn(`[ocr] missing ${model}`);
console.log('[ocr] assets ready in public/ocr');
