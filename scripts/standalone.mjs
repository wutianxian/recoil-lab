import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const dist = new URL('../dist/', import.meta.url);
const source = readFileSync(new URL('index.html', dist), 'utf8');
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(version, /^\d+\.\d+\.\d+$/, 'Expected a numeric package version');

// ponytail: the game has one Vite entry and one stylesheet. Reject additional bundles or assets.
const [scriptTag, scriptPath] = source.match(/<script type="module" crossorigin src="(?:\.?\/)?(assets\/[\w.-]+\.js)"><\/script>/) ?? [];
const [styleTag, stylePath] = source.match(/<link rel="stylesheet" crossorigin href="(?:\.?\/)?(assets\/[\w.-]+\.css)">/) ?? [];
assert.ok(scriptPath && stylePath, 'Expected one Vite script and stylesheet');
assert.deepEqual(readdirSync(dist).sort(), ['assets', 'index.html'], 'Unexpected build assets');
assert.deepEqual(readdirSync(new URL('assets/', dist)).sort(),
  [basename(scriptPath), basename(stylePath)].sort(), 'Unexpected build assets');

const js = readFileSync(new URL(scriptPath, dist), 'utf8');
const css = readFileSync(new URL(stylePath, dist), 'utf8');
new Script(js, { filename: scriptPath }); // Parse as a script to catch static imports and import.meta.
assert.doesNotMatch(js, /\bimport(?:\s|\/\*[^]*?\*\/|\/\/[^\r\n]*)*\(/, 'Dynamic import cannot be inlined');
assert.doesNotMatch(js, /<\/script\b|<!--|sourceMappingURL=/i, 'Script cannot be inlined');
assert.doesNotMatch(css, /<\/style\b|sourceMappingURL=|@import\b/i, 'Stylesheet cannot be inlined');

const inlineUrl = /^(?:data:|#)/i;
for (const [, doubleQuoted, singleQuoted, bare] of css.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
  const value = (doubleQuoted ?? singleQuoted ?? bare).trim();
  assert.match(value, inlineUrl, `Stylesheet references an external asset: ${value}`);
}

const markup = source.replace('class="brand" href="./"', 'class="brand" href="#"');
const unchangedMarkup = markup.replace(scriptTag, '').replace(styleTag, '');
for (const [tag] of unchangedMarkup.matchAll(/<[a-z][\w:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
  for (const [, name, doubleQuoted, singleQuoted, bare] of tag.matchAll(/\s(src|srcset|href|xlink:href|poster|data|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = (doubleQuoted ?? singleQuoted ?? bare).trim();
    assert.ok(name.toLowerCase() !== 'srcset' && inlineUrl.test(value), `Markup references an external asset: ${name}="${value}"`);
  }
}

const html = markup.replace(scriptTag, () => `<script type="module">\n${js}\n</script>`)
  .replace(styleTag, () => `<style>\n${css}\n</style>`);
const release = fileURLToPath(new URL('../release/', import.meta.url));
const releaseName = `Recoil-Lab-v${version}`;
const hash = createHash('sha256').update(html).digest('hex').slice(0, 12);
mkdirSync(release, { recursive: true });

// Write the complete file atomically without replacing an existing release.
const staging = mkdtempSync(join(release, '.standalone-'));
let output;
try {
  const staged = join(staging, 'index.html');
  writeFileSync(staged, html);
  for (const name of [releaseName, `${releaseName}-${hash}`]) {
    const path = join(release, `${name}.html`);
    try {
      linkSync(staged, path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (readFileSync(path, 'utf8') !== html) continue;
    }
    output = path;
    break;
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}
assert.ok(output, 'Could not write the standalone release without replacing an existing file');
console.log(`Standalone: ${output}`);
