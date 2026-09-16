import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadRoutes, validateRoutes, renderLlmsTxt, zoneUrl } from '../build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');
const routes = loadRoutes(ROOT);

test('routes.json validates', () => {
  assert.deepEqual(validateRoutes(routes), []);
});

test('validation rejects moving refs, non-template roles, and other hosts', () => {
  const clone = () => JSON.parse(JSON.stringify(routes));
  let r = clone();
  r.sources['agent-sop'].ref = 'main';
  assert.ok(validateRoutes(r).some((e) => e.includes('40-hex')));
  r = clone();
  r.sources['agent-sop'].role = 'instance';
  assert.ok(validateRoutes(r).some((e) => e.includes('role')));
  r = clone();
  r.zones[0].sections[0].links.push({ name: 'x', note: 'y', url: 'http://example.com' });
  assert.ok(validateRoutes(r).some((e) => e.includes('https')));
  r = clone();
  r.config = '~/.config/agentsop/org.toml';
  assert.ok(validateRoutes(r).some((e) => e.includes('config.toml')));
});

test('every zone has a content file and every content file has a zone', () => {
  const ids = routes.zones.map((z) => z.id).sort();
  const files = readdirSync(join(ROOT, 'content')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
  assert.deepEqual(files, ids);
});

test('llms.txt follows the spec shape: H1, blockquote, H2 link lists', () => {
  for (const zone of routes.zones) {
    const text = renderLlmsTxt(routes, zone);
    const lines = text.split('\n');
    assert.match(lines[0], /^# /, `${zone.id} starts with an H1`);
    assert.equal(lines[1], '');
    assert.match(lines[2], /^> /, `${zone.id} has a blockquote summary`);
    assert.ok(!/^#{3,} /m.test(text), `${zone.id} has no H3+ headings`);
    const items = text.match(/^- .*$/gm) ?? [];
    for (const item of items) assert.match(item, /^- \[[^\]]+\]\(https:\/\/[^)]+\): .+$/, `${zone.id}: ${item}`);
  }
});

test('the root zone links every other zone exactly once, at its folder URL', () => {
  const root = routes.zones.find((z) => z.id === 'root');
  const text = renderLlmsTxt(routes, root);
  for (const zone of routes.zones.filter((z) => z.id !== 'root')) {
    const hits = text.split(`${zoneUrl(routes, zone)}llms.txt`).length - 1;
    assert.equal(hits, 1, `${zone.id} linked once from root`);
    assert.equal(zoneUrl(routes, zone), `https://${routes.domain}/${zone.id}/`);
  }
});

test('the root and start zones name the config file', () => {
  for (const id of ['root', 'start']) {
    const text = renderLlmsTxt(routes, routes.zones.find((z) => z.id === id));
    assert.ok(text.includes(routes.config), `${id} names ${routes.config}`);
  }
});

test('build writes three files per zone plus CNAME and .nojekyll', () => {
  const written = build({ root: ROOT, out: OUT, builtAt: '2026-09-15' });
  assert.equal(written.length, routes.zones.length * 3);
  for (const zone of routes.zones) {
    const dir = zone.id === 'root' ? OUT : join(OUT, zone.id);
    for (const name of ['index.html', 'llms.txt', 'llms-full.txt']) assert.ok(existsSync(join(dir, name)), `${zone.id}/${name}`);
    const full = readFileSync(join(dir, 'llms-full.txt'), 'utf8');
    const short = readFileSync(join(dir, 'llms.txt'), 'utf8');
    assert.ok(full.startsWith(short.trimEnd()), `${zone.id} llms-full.txt begins with llms.txt`);
    assert.ok(full.length > short.length, `${zone.id} llms-full.txt extends llms.txt`);
  }
  assert.equal(readFileSync(join(OUT, 'CNAME'), 'utf8'), `${routes.domain}\n`);
  assert.ok(existsSync(join(OUT, '.nojekyll')));
});

test('the built site names no instance repository', () => {
  build({ root: ROOT, out: OUT, builtAt: '2026-09-15' });
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of walk(OUT)) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/qwts-agent-/.test(text), `${file.replace(`${ROOT}/`, '')} must not name an instance or capability repository`);
    assert.ok(!/\/(main|master)\//.test(text), `${file.replace(`${ROOT}/`, '')} must not link a branch`);
  }
});

test('index.html links its own zone files relatively', () => {
  build({ root: ROOT, out: OUT, builtAt: '2026-09-15' });
  const html = readFileSync(join(OUT, 'start', 'index.html'), 'utf8');
  assert.ok(html.includes('href="llms.txt"'));
  assert.ok(!html.includes('href="/llms.txt"'));
});
