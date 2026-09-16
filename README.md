# agentsop.ai

The source of the static site at [agentsop.ai](https://agentsop.ai/): a router
that tells agents where to look for standard operating procedures. The site
knows nothing about any organization. `~/.config/agent-sop/config.toml` on the
agent's machine names the repositories; each zone says what to read in them.

Design: qwts/agent-sop discussion #372 (the owner's description and the
arrival flow in the comment of 2026-09-16).

## Zones

| Zone | Canonical URL | Alias | Says |
| --- | --- | --- | --- |
| root | `https://agentsop.ai/` | `www.agentsop.ai` | how to get started and the routing |
| start | `https://agentsop.ai/start/` | `start.agentsop.ai` | the three onboarding steps |
| org | `https://agentsop.ai/org/` | `org.agentsop.ai` | org-level facts: who is who, which agent does what, shared CI/CD |
| sop | `https://agentsop.ai/sop/` | `sop.agentsop.ai` | self-check, how-to, catalog |
| comms | `https://agentsop.ai/comms/` | `comms.agentsop.ai` | how agents communicate |

Each zone serves three files: `index.html` for people, `llms.txt` and
`llms-full.txt` for models. An alias is a 301 to the canonical folder.

Arrival: a first visit reads `index.html`, goes to `start`, and creates the
config file. A returning agent starts at `https://agentsop.ai/llms.txt` from
memory and picks a zone.

## Rules

1. The site names no repository, organization, or commit. A zone lists files
   as paths inside the repository the config file names (`[repos] org`,
   `sop`, `comms`). A test fails the build if `qwts`, `github.com`, or a
   branch name appears in the output.
2. Short. `llms.txt` stays under 1600 bytes and `llms-full.txt` under 3200;
   the tests enforce it.
3. A zone is exactly three files. No API, no search, no dynamic content.
4. What agents were told is the commit history of this repository. Changing
   a line is a pull request.

## Layout

- `routes.json`: domain, config path, the `[repos]` keys, zones, sections,
  links (`url` on this site, `zone`, or `repo` + `path`).
- `content/<zone>.md`: the short expansion appended to that zone's
  `llms-full.txt`.
- `templates/index.html`: the one page template.
- `build.mjs`: validates `routes.json` and renders `public/`.
- `test/routes.test.mjs`: shape, size, the start text, and the
  knows-nothing rule.
- `scripts/dns.mjs`: converges the Cloudflare DNS records and the alias
  redirect rule from `routes.json`.
- `.github/workflows/ci.yml`: tests and build on every PR.
- `.github/workflows/pages.yml`: builds and deploys `public/` to GitHub Pages
  on every push to `main`.

## Commands

```bash
npm run check        # tests + build (no dependencies; Node 22+)
npm run serve        # build and serve public/ on http://localhost:8788
```

## Hosting

GitHub Pages serves `public/` for the custom domain `agentsop.ai`; the
`CNAME` and `.nojekyll` files are written by the build. Cloudflare holds the
DNS. To converge the records and the alias redirect, run in a shell that has
a Cloudflare API token with Zone.DNS edit, Zone.Zone read, and Zone.Single
Redirect edit (the permission that covers redirect rules):

```bash
CLOUDFLARE_API_TOKEN=... node scripts/dns.mjs --dry-run
```

then without `--dry-run`. The token is read from the environment only.
