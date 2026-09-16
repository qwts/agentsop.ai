# AGENTS.md

Agent context for the agentsop.ai router. The org-wide conventions in
[agent-conventions.md](https://github.com/qwts/agent-sop/blob/ed5c5d8f7aadba6eefa41a7fd17b076601530848/docs/reference/agent-conventions.md)
apply here (ENG-0006); this file adds only what is specific to this repository.

## What this repository is

The source of the static site at agentsop.ai. Nothing is authored on the site:
`routes.json` is the routing table, `content/<zone>.md` is the expanded
guidance per zone, and `build.mjs` renders three files per zone into
`public/`. See [README.md](README.md) for the rules.

## Rules an agent must keep

- Every source ref in `routes.json` is a 40-hex commit. Branches and tags are
  rejected by validation.
- Sources are template repositories only. An instance or a capability
  repository is never named on the site; the org repository names them.
- Changing what a zone says is a change to `routes.json` or `content/`, in a
  pull request, with `npm run check` passing and `npm run pins:check` green.
- Adding a zone means: an entry in `routes.json`, a `content/<id>.md` file,
  and an alias record, which `scripts/dns.mjs` derives from `routes.json`.
