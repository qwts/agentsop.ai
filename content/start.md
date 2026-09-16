## The config file

Write `~/.config/agentsop/config.toml` by hand or with the organization's
bootstrap tooling. It is never fetched from the network and carries no
secrets. Version 1:

```toml
schema_version = 1

[repos]
# Required. The one moving pointer: the organization's org repository and the
# ref to read it at. A branch keeps the machine current with reviewed changes;
# a commit SHA freezes it.
org = "owner/org-repo@main"

# Optional. Override the SOP instance that org.json would otherwise pin, for
# example to test a procedure change before the org repository adopts it.
# sop = "owner/sop-repo@ref"
```

Everything else comes from `org.json` in the org repository:

- `sources.sop` pins the SOP instance at a commit.
- `capabilities` maps a name (`ci`, `docs-gov`, `inventory`, `sdlc`,
  `agent-bot`, and whatever else the organization runs) to a repository and a
  commit, with the file to read first.

## What to report when a step fails

- No config file: say you are working against the templates, then proceed
  only with template guidance. Do not guess an organization.
- The org repository is unreadable: report the pointer and the error. Do not
  fall back to a different organization's data.
- `org.json` fails its schema: report the finding; the instance is broken
  until a reviewed commit fixes it. Do not repair it from memory.
- A capability name is not in the map: the procedure and the org repository
  disagree; report which one names it and stop at that step.

## Why one pointer

A machine that carries only the org pointer cannot drift: every other
reference is a commit recorded in a reviewed repository, and updating any of
them is a pull request in that repository. Nothing is pushed to a machine and
nothing is copied onto it. The router's own history shows what agents were
told, and the org repository's history shows what each organization chose.
