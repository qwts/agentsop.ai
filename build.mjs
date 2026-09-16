#!/usr/bin/env node
// Builds public/ from routes.json, content/<zone>.md, and templates/index.html.
//
// Each zone emits exactly three files: index.html, llms.txt, llms-full.txt.
// The root zone lands in public/; every other zone in public/<zone>/. The
// site is served as static files (GitHub Pages); a zone's subdomain alias
// redirects to its folder, so the folder URL is canonical.

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'public');
const SHA = /^[0-9a-f]{40}$/;
const ROLES = ['template'];
const STATUSES = ['active', 'pending'];

export function loadRoutes(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'routes.json'), 'utf8'));
}

export function validateRoutes(routes) {
  const errors = [];
  const ids = new Set();
  const hosts = new Set();
  if (!routes.zones.some((z) => z.id === 'root')) errors.push('a zone with id "root" is required');
  if (!/^~\/\.config\/agentsop\/config\.toml$/.test(routes.config ?? '')) errors.push('config must be ~/.config/agentsop/config.toml');
  for (const zone of routes.zones) {
    if (ids.has(zone.id)) errors.push(`duplicate zone id ${zone.id}`);
    ids.add(zone.id);
    if (!/^[a-z]+$/.test(zone.id)) errors.push(`zone id ${zone.id} must be lowercase letters`);
    if (hosts.has(zone.host)) errors.push(`duplicate zone host ${zone.host}`);
    hosts.add(zone.host);
    const expectedHost = zone.id === 'root' ? routes.domain : `${zone.id}.${routes.domain}`;
    if (zone.host !== expectedHost) errors.push(`zone ${zone.id} host must be ${expectedHost}, got ${zone.host}`);
    if (!zone.title || !zone.summary) errors.push(`zone ${zone.id} needs title and summary`);
    for (const section of zone.sections ?? []) {
      if (!section.heading) errors.push(`zone ${zone.id} has a section without a heading`);
      for (const key of section.sources ?? []) {
        if (!routes.sources[key]) errors.push(`zone ${zone.id} section ${section.heading} references unknown source ${key}`);
      }
      for (const link of section.links ?? []) {
        if (!link.name || !link.note) errors.push(`zone ${zone.id} section ${section.heading} has a link without name/note`);
        const kinds = ['url', 'src', 'zone'].filter((k) => link[k]);
        if (kinds.length !== 1) errors.push(`link ${link.name} in ${zone.id}/${section.heading} must have exactly one of url, src, zone`);
        if (link.src && !routes.sources[link.src]) errors.push(`link ${link.name} references unknown source ${link.src}`);
        if (link.src && !link.path) errors.push(`link ${link.name} has src but no path`);
        if (link.zone && !routes.zones.some((z) => z.id === link.zone)) errors.push(`link ${link.name} references unknown zone ${link.zone}`);
        if (link.url && !/^https:\/\//.test(link.url)) errors.push(`link ${link.name} url must be https`);
      }
    }
  }
  for (const [key, source] of Object.entries(routes.sources)) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(source.repo)) errors.push(`source ${key} repo must be owner/name`);
    if (!SHA.test(source.ref ?? '')) errors.push(`source ${key} ref must be a 40-hex commit SHA (branches and tags move)`);
    if (!ROLES.includes(source.role)) errors.push(`source ${key} role must be one of ${ROLES.join(', ')}: instances and capabilities are named by an org repository, never by this router`);
    if (!STATUSES.includes(source.status)) errors.push(`source ${key} status is invalid`);
    if (!source.note) errors.push(`source ${key} needs a note`);
  }
  return errors;
}

export function rawUrl(source, path) {
  return `https://raw.githubusercontent.com/${source.repo}/${source.ref}/${path}`;
}

export function blobUrl(source, path) {
  return `https://github.com/${source.repo}/blob/${source.ref}/${path}`;
}

// Canonical zone URL: the root of the host, or a folder under it.
export function zoneUrl(routes, zone) {
  return zone.id === 'root' ? `https://${routes.domain}/` : `https://${routes.domain}/${zone.id}/`;
}

function zoneById(routes, id) {
  return routes.zones.find((z) => z.id === id);
}

// Resolve a link to { name, url, humanUrl, note }.
export function resolveLink(routes, link) {
  if (link.url) return { name: link.name, url: link.url, humanUrl: link.url, note: link.note };
  if (link.zone) {
    const target = zoneById(routes, link.zone);
    const base = zoneUrl(routes, target);
    return { name: link.name, url: `${base}llms.txt`, humanUrl: base, note: link.note };
  }
  const source = routes.sources[link.src];
  return { name: link.name, url: rawUrl(source, link.path), humanUrl: blobUrl(source, link.path), note: link.note };
}

function sourceLinks(routes, keys) {
  return keys.map((key) => {
    const source = routes.sources[key];
    const status = source.status === 'pending' ? ' Status: pending.' : '';
    return {
      name: source.repo,
      url: `https://github.com/${source.repo}/tree/${source.ref}`,
      humanUrl: `https://github.com/${source.repo}/tree/${source.ref}`,
      note: `${source.role} at commit ${source.ref.slice(0, 7)}. ${source.note}${status}`,
    };
  });
}

export function sectionLinks(routes, section) {
  const links = (section.links ?? []).map((link) => resolveLink(routes, link));
  if (section.sources) links.push(...sourceLinks(routes, section.sources));
  return links;
}

export function renderLlmsTxt(routes, zone) {
  const lines = [`# ${zone.title}`, '', `> ${zone.summary}`, ''];
  for (const paragraph of zone.intro ?? []) lines.push(paragraph, '');
  for (const section of zone.sections ?? []) {
    lines.push(`## ${section.heading}`, '');
    for (const link of sectionLinks(routes, section)) lines.push(`- [${link.name}](${link.url}): ${link.note}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderLlmsFull(routes, zone, extra) {
  const base = renderLlmsTxt(routes, zone).trimEnd();
  if (!extra) return `${base}\n`;
  return `${base}\n\n${extra.trim()}\n`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function paragraphsToHtml(paragraphs) {
  return paragraphs
    .map((paragraph) => {
      const listMatch = paragraph.match(/^(.*?):\n\n((?:\d+\. .*\n?)+)$/s);
      if (listMatch) {
        const items = listMatch[2]
          .trim()
          .split('\n')
          .map((line) => `<li>${escapeHtml(line.replace(/^\d+\. /, ''))}</li>`)
          .join('');
        return `<p>${escapeHtml(listMatch[1])}:</p><ol>${items}</ol>`;
      }
      return `<p>${escapeHtml(paragraph)}</p>`;
    })
    .join('\n');
}

export function renderIndexHtml(routes, zone, template, builtAt) {
  const nav = routes.zones
    .map((z) => {
      const current = z.id === zone.id ? ' aria-current="page"' : '';
      return `<a href="${zoneUrl(routes, z)}"${current}>${escapeHtml(z.id === 'root' ? routes.domain : z.id)}</a>`;
    })
    .join('\n');
  const sections = (zone.sections ?? [])
    .map((section) => {
      const items = sectionLinks(routes, section)
        .map((link) => `<li><a href="${escapeHtml(link.humanUrl)}">${escapeHtml(link.name)}</a><span>${escapeHtml(link.note)}</span></li>`)
        .join('\n');
      return `<section><h2>${escapeHtml(section.heading)}</h2><ul class="links">${items}</ul></section>`;
    })
    .join('\n');
  return template
    .replaceAll('{{TITLE}}', escapeHtml(zone.title))
    .replaceAll('{{HOST}}', escapeHtml(zone.host))
    .replaceAll('{{SUMMARY}}', escapeHtml(zone.summary))
    .replaceAll('{{INTRO}}', paragraphsToHtml(zone.intro ?? []))
    .replaceAll('{{NAV}}', nav)
    .replaceAll('{{SECTIONS}}', sections)
    .replaceAll('{{BUILT}}', escapeHtml(builtAt));
}

export function build({ root = ROOT, out = OUT, builtAt = new Date().toISOString().slice(0, 10) } = {}) {
  const routes = loadRoutes(root);
  const errors = validateRoutes(routes);
  if (errors.length > 0) throw new Error(`routes.json is invalid:\n  - ${errors.join('\n  - ')}`);
  const template = readFileSync(join(root, 'templates', 'index.html'), 'utf8');

  rmSync(out, { recursive: true, force: true });
  const written = [];
  for (const zone of routes.zones) {
    const dir = zone.id === 'root' ? out : join(out, zone.id);
    mkdirSync(dir, { recursive: true });
    const extraPath = join(root, 'content', `${zone.id}.md`);
    const extra = existsSync(extraPath) ? readFileSync(extraPath, 'utf8') : '';
    const files = {
      'llms.txt': renderLlmsTxt(routes, zone),
      'llms-full.txt': renderLlmsFull(routes, zone, extra),
      'index.html': renderIndexHtml(routes, zone, template, builtAt),
    };
    for (const [name, body] of Object.entries(files)) {
      const file = join(dir, name);
      writeFileSync(file, body);
      written.push(file);
    }
  }
  // GitHub Pages: the custom domain travels with the artifact, and Jekyll
  // must not process the tree.
  writeFileSync(join(out, 'CNAME'), `${routes.domain}\n`);
  writeFileSync(join(out, '.nojekyll'), '');
  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const written = build();
  for (const file of written) console.log(file.replace(`${ROOT}/`, ''));
}
