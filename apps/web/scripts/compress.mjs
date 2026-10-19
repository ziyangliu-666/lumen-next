// Writes a .br and a .gz beside each text file of the build, so the server
// (@fastify/static with preCompressed) sends the compressed copy to a
// browser that accepts it. Without them the first visit downloaded the
// script at its full 1 MB: the server compresses nothing on the fly.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const TEXT = /\.(js|css|html|svg|json|txt|map)$/;
/** Below this a compressed copy saves less than the extra file costs. */
const MIN_BYTES = 1024;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files = 0;
let before = 0;
let after = 0;
for (const path of walk(ROOT)) {
  if (!TEXT.test(path)) continue;
  const body = readFileSync(path);
  if (body.length < MIN_BYTES) continue;
  const br = brotliCompressSync(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
    },
  });
  writeFileSync(`${path}.br`, br);
  writeFileSync(`${path}.gz`, gzipSync(body, { level: 9 }));
  files += 1;
  before += body.length;
  after += br.length;
}
console.log(
  `compressed ${files} files: ${Math.round(before / 1024)} kB to ${Math.round(after / 1024)} kB (brotli)`,
);
