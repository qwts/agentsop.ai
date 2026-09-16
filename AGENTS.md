# AGENTS.md

Agent context for the agentsop.ai router. See [README.md](README.md) for the
rules; this file adds only what an agent editing this repository must keep.

- The site knows nothing about any organization. Never add a repository
  name, an organization name, a commit, or a link off `agentsop.ai`. The
  tests reject `qwts`, `github.com`, and branch names in the built output.
- Zones list files as paths in the repository the config file names
  (`[repos] org`, `sop`, `comms`). Changing what a zone says is a change to
  `routes.json` or `content/`, in a pull request, with `npm run check`
  passing.
- The start zone's text is the owner's, verbatim, from discussion #372. Do
  not edit it without the owner's words to replace it with.
- Adding a zone means: an entry in `routes.json`, a `content/<id>.md` file,
  and an alias record, which `scripts/dns.mjs` derives from `routes.json`.
