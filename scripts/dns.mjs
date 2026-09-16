#!/usr/bin/env node
// Idempotent DNS and alias setup for the router on Cloudflare.
//
//   CLOUDFLARE_API_TOKEN=... node scripts/dns.mjs [--dry-run]
//
// Token permissions: Zone > DNS > Edit, Zone > Zone > Read, and for the
// subdomain aliases Zone > Single Redirect > Edit (Cloudflare's name for the
// redirect-rules permission). The token is read from
// the environment and never printed or written.
//
// What it converges to, from routes.json:
//   apex        A x4, AAAA x4 -> GitHub Pages, DNS only (GitHub issues the certificate)
//   www         CNAME -> <account>.github.io, DNS only (GitHub redirects www to the apex)
//   <zone>      AAAA 100:: proxied, plus one redirect rule: https://<zone>.<domain>/* -> https://<domain>/<zone>/*
// Existing records and rules that this script does not own are left alone.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const routes = JSON.parse(readFileSync(join(ROOT, 'routes.json'), 'utf8'));
const DOMAIN = routes.domain;
const PAGES_ACCOUNT = 'qwts';
const PAGES_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const PAGES_AAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'];
const RULE_DESCRIPTION = `${DOMAIN} zone aliases (managed by scripts/dns.mjs)`;
const API = 'https://api.cloudflare.com/client/v4';
const dryRun = process.argv.includes('--dry-run');

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error('CLOUDFLARE_API_TOKEN is not set. Export it in this shell and run again; it is never printed.');
  process.exit(2);
}

async function cf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`${method} ${path}: ${JSON.stringify(data.errors)}`);
  return data.result;
}

function say(action, detail) {
  console.log(`${dryRun ? '[dry-run] ' : ''}${action} ${detail}`);
}

async function upsert(zoneId, existing, want) {
  // want: { type, name, contents: [..], proxied }
  const fqdn = want.name === '@' ? DOMAIN : `${want.name}.${DOMAIN}`;
  const current = existing.filter((r) => r.type === want.type && r.name === fqdn);
  for (const content of want.contents) {
    const match = current.find((r) => r.content.toLowerCase() === content.toLowerCase());
    if (match && match.proxied === want.proxied) {
      say('keep', `${want.type} ${fqdn} ${content}`);
      continue;
    }
    if (match) {
      say('update', `${want.type} ${fqdn} ${content} proxied=${want.proxied}`);
      if (!dryRun) await cf('PATCH', `/zones/${zoneId}/dns_records/${match.id}`, { proxied: want.proxied });
      continue;
    }
    say('create', `${want.type} ${fqdn} ${content} proxied=${want.proxied}`);
    if (!dryRun) await cf('POST', `/zones/${zoneId}/dns_records`, { type: want.type, name: fqdn, content, proxied: want.proxied, ttl: 1 });
  }
  for (const stray of current.filter((r) => !want.contents.some((c) => c.toLowerCase() === r.content.toLowerCase()))) {
    say('remove', `${want.type} ${fqdn} ${stray.content} (not in the wanted set)`);
    if (!dryRun) await cf('DELETE', `/zones/${zoneId}/dns_records/${stray.id}`);
  }
}

async function ensureRedirect(zoneId) {
  const aliases = routes.zones.filter((z) => z.id !== 'root');
  const expression = `(http.host wildcard "*.${DOMAIN}" and http.host ne "www.${DOMAIN}")`;
  const rule = {
    description: RULE_DESCRIPTION,
    expression,
    action: 'redirect',
    enabled: true,
    action_parameters: {
      from_value: {
        status_code: 301,
        preserve_query_string: false,
        target_url: { expression: `wildcard_replace(http.request.full_uri, "https://*.${DOMAIN}/*", "https://${DOMAIN}/\${1}/\${2}")` },
      },
    },
  };
  let entry = null;
  try {
    entry = await cf('GET', `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`);
  } catch (error) {
    if (/"code":10000/.test(error.message)) {
      throw new Error(`${error.message}\nThe token cannot read this zone's redirect rules. It needs the permission Zone > Single Redirect > Edit (Cloudflare's name for redirect rules); the DNS records did not need it. Edit the token, add that row, click Update Token, then rerun.`);
    }
    if (!/not.?found|does not exist|"code":100(03|05)/i.test(error.message)) throw error;
  }
  const existing = entry?.rules?.find((r) => r.description === RULE_DESCRIPTION);
  if (existing && existing.expression === expression && existing.action_parameters?.from_value?.target_url?.expression === rule.action_parameters.from_value.target_url.expression) {
    say('keep', `redirect rule for ${aliases.map((z) => z.host).join(', ')}`);
    return;
  }
  if (!entry) {
    say('create', `redirect ruleset with one rule (${aliases.length} aliases)`);
    if (!dryRun) await cf('PUT', `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`, { rules: [rule] });
    return;
  }
  if (existing) {
    say('update', 'redirect rule');
    if (!dryRun) await cf('PATCH', `/zones/${zoneId}/rulesets/${entry.id}/rules/${existing.id}`, rule);
    return;
  }
  say('create', 'redirect rule alongside existing rules');
  if (!dryRun) await cf('POST', `/zones/${zoneId}/rulesets/${entry.id}/rules`, rule);
}

const zones = await cf('GET', `/zones?name=${DOMAIN}`);
if (zones.length !== 1) throw new Error(`expected exactly one Cloudflare zone named ${DOMAIN}, found ${zones.length}`);
const zoneId = zones[0].id;
const existing = await cf('GET', `/zones/${zoneId}/dns_records?per_page=500`);

await upsert(zoneId, existing, { type: 'A', name: '@', contents: PAGES_A, proxied: false });
await upsert(zoneId, existing, { type: 'AAAA', name: '@', contents: PAGES_AAAA, proxied: false });
await upsert(zoneId, existing, { type: 'CNAME', name: 'www', contents: [`${PAGES_ACCOUNT}.github.io`], proxied: false });
for (const zone of routes.zones.filter((z) => z.id !== 'root')) {
  await upsert(zoneId, existing, { type: 'AAAA', name: zone.id, contents: ['100::'], proxied: true });
}
await ensureRedirect(zoneId);
console.log(dryRun ? 'Dry run complete; nothing changed.' : 'Done. GitHub Pages verifies the apex within minutes and issues the certificate after that.');
