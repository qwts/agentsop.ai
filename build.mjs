#!/usr/bin/env node
// Builds public/ from routes.json, content/<zone>.md, and templates/index.html.
//
// Each zone emits exactly three files: index.html, llms.txt, llms-full.txt.
// The root zone lands in public/; every other zone in public/<zone>/. The
// site is served as static files (GitHub Pages); a zone's subdomain alias
// redirects to its folder, so the folder URL is canonical.
//
// The site names no repository. A zone lists files as paths inside the
// repository that ~/.config/agent-sop/config.toml names under [repos];
// the only absolute links are to the site itself.

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'public');

export function loadRoutes(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'routes.json'), 'utf8'));
}

export function validateRoutes(routes) {
  const errors = [];
  const ids = new Set();
  const hosts = new Set();
  if (!routes.zones.some((z) => z.id === 'root')) errors.push('a zone with id "root" is required');
  if (routes.config !== '~/.config/agent-sop/config.toml') errors.push('config must be ~/.config/agent-sop/config.toml');
  if (!routes.repos || typeof routes.repos !== 'object') errors.push('repos must map each config key to a one-line description');
  for (const zone of routes.zones) {
    if (ids.has(zone.id)) errors.push(`duplicate zone id ${zone.id}`);
    ids.add(zone.id);
    if (!/^[a-z]+$/.test(zone.id)) errors.push(`zone id ${zone.id} must be lowercase letters`);
    if (hosts.has(zone.host)) errors.push(`duplicate zone host ${zone.host}`);
    hosts.add(zone.host);
    const expectedHost = zone.id === 'root' ? routes.domain : `${zone.id}.${routes.domain}`;
    if (zone.host !== expectedHost) errors.push(`zone ${zone.id} host must be ${expectedHost}, got ${zone.host}`);
    if (!zone.title) errors.push(`zone ${zone.id} needs a title`);
    for (const section of zone.sections ?? []) {
      if (!section.heading) errors.push(`zone ${zone.id} has a section without a heading`);
      for (const link of section.links ?? []) {
        if (!link.name || !link.note) errors.push(`zone ${zone.id} section ${section.heading} has a link without name/note`);
        const kinds = ['url', 'path', 'zone'].filter((k) => link[k]);
        if (kinds.length !== 1) errors.push(`link ${link.name} in ${zone.id}/${section.heading} must have exactly one of url, path, zone`);
        if (link.path && !(routes.repos ?? {})[link.repo]) errors.push(`link ${link.name} names an unknown repo key ${link.repo}; keys are the [repos] entries of the config file`);
        if (link.path && /^\/|\.\./.test(link.path)) errors.push(`link ${link.name} path must be relative to the repository root`);
        if (link.zone && !routes.zones.some((z) => z.id === link.zone)) errors.push(`link ${link.name} references unknown zone ${link.zone}`);
        if (link.url && !/^https:\/\//.test(link.url)) errors.push(`link ${link.name} url must be https`);
        if (link.url && !link.url.startsWith(`https://${routes.domain}/`)) errors.push(`link ${link.name} url must stay on ${routes.domain}; repositories are named only by the config file`);
      }
    }
  }
  return errors;
}

// Canonical zone URL: the root of the host, or a folder under it.
export function zoneUrl(routes, zone) {
  return zone.id === 'root' ? `https://${routes.domain}/` : `https://${routes.domain}/${zone.id}/`;
}

function zoneById(routes, id) {
  return routes.zones.find((z) => z.id === id);
}

// Resolve a link to { name, url?, path?, repo?, note }. A path link is a file
// in the repository the config file names under [repos] <repo>; the site
// never knows which repository that is.
export function resolveLink(routes, link) {
  if (link.url) return { name: link.name, url: link.url, humanUrl: link.url, note: link.note };
  if (link.zone) {
    const target = zoneById(routes, link.zone);
    const base = zoneUrl(routes, target);
    return { name: link.name, url: `${base}llms.txt`, humanUrl: base, note: link.note };
  }
  return { name: link.name, path: link.path, repo: link.repo, note: link.note };
}

// A path link names its repository only when the zone's sections mix repos.
function pathLabel(zone, link) {
  const repos = new Set();
  for (const section of zone.sections ?? []) for (const l of section.links ?? []) if (l.repo) repos.add(l.repo);
  return repos.size > 1 ? `\`${link.path}\` (${link.repo} repository)` : `\`${link.path}\``;
}

export function sectionLinks(routes, section) {
  return (section.links ?? []).map((link) => resolveLink(routes, link));
}

function llmsItem(zone, link) {
  if (link.url) return `- [${link.name}](${link.url}): ${link.note}`;
  return `- ${pathLabel(zone, link)}: ${link.note}`;
}

export function renderLlmsTxt(routes, zone) {
  const lines = [`# ${zone.title}`, ''];
  if (zone.summary) lines.push(`> ${zone.summary}`, '');
  for (const paragraph of zone.intro ?? []) lines.push(paragraph, '');
  for (const section of zone.sections ?? []) {
    lines.push(`## ${section.heading}`, '');
    for (const link of sectionLinks(routes, section)) lines.push(llmsItem(zone, link));
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

// Site URLs in prose become links so a person landing on index.html can
// follow the same path an agent reads in llms.txt.
function linkify(escaped) {
  return escaped.replace(/https:\/\/agentsop\.ai\/[\w./-]*[\w/]/g, (url) => `<a href="${url}">${url}</a>`);
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
      return `<p>${linkify(escapeHtml(paragraph))}</p>`;
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
        .map((link) => {
          const label = link.url
            ? `<a href="${escapeHtml(link.humanUrl)}">${escapeHtml(link.name)}</a>`
            : `<code>${escapeHtml(pathLabel(zone, link).replaceAll('`', ''))}</code>`;
          return `<li>${label}<span>${escapeHtml(link.note)}</span></li>`;
        })
        .join('\n');
      return `<section><h2>${escapeHtml(section.heading)}</h2><ul class="links">${items}</ul></section>`;
    })
    .join('\n');
  return template
    .replaceAll('<p class="summary">{{SUMMARY}}</p>', zone.summary ? '<p class="summary">{{SUMMARY}}</p>' : '')
    .replaceAll('{{TITLE}}', escapeHtml(zone.title))
    .replaceAll('{{HOST}}', escapeHtml(zone.host))
    .replaceAll('{{SUMMARY}}', escapeHtml(zone.summary ?? ''))
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
