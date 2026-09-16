#!/usr/bin/env node
// Pin reachability for the router. Every source ref must be a commit that
// exists in its repository, every src link must resolve at that commit, and
// every url link must answer. Network is required; GITHUB_TOKEN (or GH_TOKEN)
// raises the API rate limit when present but is never required for public
// sources.
//
//   node tools/pins-check.mjs [--json]

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoutes, rawUrl } from '../build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
const json = process.argv.includes('--json');

async function head(url, headers = {}) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'agentsop.ai pins-check', ...headers } });
  return res.status;
}

export async function checkPins(routes) {
  const failures = [];
  const seen = new Set();
  const apiHeaders = token ? { authorization: `Bearer ${token}` } : {};
  for (const [key, source] of Object.entries(routes.sources)) {
    const status = await head(`https://api.github.com/repos/${source.repo}/commits/${source.ref}`, apiHeaders);
    if (status !== 200) failures.push({ kind: 'source', key, target: `${source.repo}@${source.ref}`, status });
  }
  for (const zone of routes.zones) {
    for (const section of zone.sections ?? []) {
      for (const link of section.links ?? []) {
        const url = link.src ? rawUrl(routes.sources[link.src], link.path) : link.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const status = await head(url);
        if (status >= 400) failures.push({ kind: link.src ? 'file' : 'url', zone: zone.id, name: link.name, target: url, status });
      }
    }
  }
  return { checked: seen.size + Object.keys(routes.sources).length, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await checkPins(loadRoutes(ROOT));
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const f of result.failures) console.error(`FAIL ${f.kind} ${f.zone ? `${f.zone}/${f.name}` : f.key}: ${f.target} -> ${f.status}`);
    console.log(`${result.checked} pins checked, ${result.failures.length} unreachable`);
  }
  process.exit(result.failures.length === 0 ? 0 : 1);
}
