# agentsop.ai

The source of the static site at [agentsop.ai](https://agentsop.ai/): a router
that tells agents where standard operating procedures live. It authors nothing.
Each zone serves three files, `index.html`, `llms.txt`, and `llms-full.txt`,
made entirely of pinned links into reviewed Git repositories and short notes
about when to follow each one.

Design: [qwts/agent-sop discussion #372](https://github.com/qwts/agent-sop/discussions/372).

## Zones

| Zone | Canonical URL | Alias | Answers |
| --- | --- | --- | --- |
| root | `https://agentsop.ai/` | `www.agentsop.ai` | the map of zones and the five-step procedure |
| start | `https://agentsop.ai/start/` | `start.agentsop.ai` | the one local config file and the resolution order |
| org | `https://agentsop.ai/org/` | `org.agentsop.ai` | the organization configuration contract |
| sop | `https://agentsop.ai/sop/` | `sop.agentsop.ai` | procedures, decisions, guides |
| comms | `https://agentsop.ai/comms/` | `comms.agentsop.ai` | how agents communicate and who speaks |
| skills | `https://agentsop.ai/skills/` | `skills.agentsop.ai` | how skills and capabilities are cataloged and loaded |

An alias is a 301 to the canonical folder. Zones route questions; the org
repository named by `~/.config/agentsop/config.toml` routes names. Capability
repositories (shared CI, the docs gate, the inventory, the AI primitives) are
pinned there and never get a zone.

## Rules

1. `routes.json` is the only routing table. Every source is a template
   repository pinned to a 40-hex commit; validation rejects branches, tags,
   instance repositories, and non-https links.
2. No instance or capability repository is named anywhere on the site. A test
   fails the build if one appears.
3. A zone is exactly three files. No API, no search, no dynamic content.
4. What agents were told is the commit history of this repository. Changing
   a link or a note is a pull request.

## Layout

- `routes.json`: domain, config path, sources, zones, sections, links.
- `content/<zone>.md`: the expanded guidance appended to that zone's
  `llms-full.txt`.
- `templates/index.html`: the one page template.
- `build.mjs`: validates `routes.json` and renders `public/`.
- `test/routes.test.mjs`: shape, validation, and the no-instance-names rule.
- `tools/pins-check.mjs`: network check that every pinned commit and file
  resolves.
- `scripts/dns.mjs`: converges the Cloudflare DNS records and the alias
  redirect rule from `routes.json`.
- `.github/workflows/ci.yml`: tests, build, and pin check on every PR.
- `.github/workflows/pages.yml`: builds and deploys `public/` to GitHub Pages
  on every push to `main`.

## Commands

```bash
npm run check        # tests + build (no dependencies; Node 22+)
npm run pins:check   # every pinned link resolves (network)
npm run serve        # build and serve public/ on http://localhost:8788
```

## Hosting

GitHub Pages serves `public/` for the custom domain `agentsop.ai`; the
`CNAME` and `.nojekyll` files are written by the build. Cloudflare holds the
DNS. To converge the records and the alias redirect, run in a shell that has
a Cloudflare API token with Zone.DNS edit, Zone.Zone read, and Zone.Dynamic
Redirect edit:

```bash
CLOUDFLARE_API_TOKEN=... node scripts/dns.mjs --dry-run
```

then without `--dry-run`. The token is read from the environment only. After
the apex resolves, GitHub verifies the domain and issues the certificate;
enforce HTTPS in the repository's Pages settings once it shows as issued.

## Provenance

Extracted from the router prototype built on 2026-09-15 while the split of
[qwts/agent-sop](https://github.com/qwts/agent-sop) into templates, instances,
and capabilities was decided in discussions #365, #367, #371, and #372.
