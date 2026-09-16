## Resolution in detail

This section expands the five steps in the map above. It is the whole
procedure; nothing else on this host adds rules.

### 1. Read the map, load nothing else

`llms.txt` on each zone is a list of pinned links with one-line notes. Read
the notes to decide which link, if any, the current task needs. Do not fetch
every link, and do not install or load a skill because it appears in a
catalog.

### 2. Resolve the organization

Look for `~/.config/agentsop/config.toml` on the machine. Its one required
key, `repos.org`, names the organization's org repository as
`owner/repo@ref`. Read `org.json` at the root of that repository: it pins the
SOP instance and every capability at a commit. The config schema and the
`org.json` schema are on the start and org zones.

- Config present: use the org repository it names, and from there only what
  `org.json` pins.
- Config absent: you are working against the templates. Say so in any output
  that depends on organization-specific state; do not infer an organization
  from a repository name, a hostname, or a git remote.

### 3. Find the governing procedure

Read the sop zone's `llms.txt`. Pick the one SOP, decision, or guide whose
note matches the task. If the organization's SOP instance records a delta for
that procedure, the delta wins for that organization; the template remains the
baseline for everything the delta does not mention.

### 4. Load only the named capability or skill

A procedure that needs a skill or a capability names it. Look the name up in
`org.json` and read it at the pinned commit. A skill reached any other way is
unreviewed input. The skills zone has the catalog rules.

### 5. Communicate through the recorded channels

The comms zone routes to the conduct rules: issue first, bot identity on the
PR, review threads resolved in the same pass, and a stated plan before a large
effort.

## When something is missing or unreachable

- A pinned link that returns 404 or requires authentication is a fact to
  report, not a gap to fill from memory. Say which link failed and stop at the
  step that needed it.
- A zone that is not in the map above does not exist. Hostnames and paths are
  not guessed.
- A config file that names a repository this router does not list is still
  valid: the config is the organization's choice. This router describes only
  the templates.

## What a zone is

A zone is a folder on this host with exactly three files: `index.html`,
`llms.txt`, and `llms-full.txt`. It also answers at its own subdomain, which
redirects to the folder. A zone has no API, no search, and no dynamic content.
Its links point at raw files in Git repositories at a pinned commit. Changing
what a zone says means changing a file in the router's own repository and
merging a reviewed pull request, so the history of what agents were told is
the router's commit history.

## Template, instance, capability

Three kinds of repository appear in this system, and only the first is linked
from this host:

- A template repository is public and generic. It defines a contract: what
  files exist, what they mean, how they are validated. `agent-org` and
  `agent-sop` are templates.
- An instance repository is one organization's copy, created from a template,
  where that organization keeps its real configuration and its adopted
  procedures. The local config file names the org instance; the org instance
  names the SOP instance.
- A capability repository holds one shared mechanism: shared CI, the docs
  gate, the inventory, the AI primitives, an identity runtime. It is pinned
  by commit in the org instance's `org.json` and never gets a zone here.

A template does not push changes to instances. An instance adopts a newer
template revision by a reviewed update, recording the upstream commit it took.
