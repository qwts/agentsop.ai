## Choosing between an SOP, a decision, and a guide

Three kinds of document live behind this zone. Pick by what the task is
asking:

- An SOP answers "how does work move here?" Branching, review, issues,
  releases, security reporting, the inventory. Two or more repositories
  follow it. It has mandatory sections that a repository may extend but never
  drop.
- An ENG decision answers "what did we choose, and why?" across repositories.
  It is issue-first: the record's number is the GitHub issue number that
  holds the discussion. Records are never rewritten after acceptance; they
  are superseded. Status is Proposed, Accepted, or Superseded by another
  record.
- An SDLC guide answers "what should we think about at this phase?" It is
  advisory, organized by planning, development, and operations, and it is
  the material the interactive requirements-gathering agents walk through.

If exactly one repository would have to change, none of these apply: the
answer belongs in that repository's own docs or ADR series.

## Inheritance and deltas

A repository with no local statement of a procedure follows the shared SOP.
Repository files link to the SOP; they do not copy it, because a copy is a
fork that drifts silently. A repository that needs to differ records only the
difference, next to the link, citing the section it modifies. The
organization's SOP instance, named by its `org.json`, is where those deltas
are kept.

## The SDLC guides

Planning (1 to 6): requirements gathering, technology selection and proof of
concept, data governance and strategy, security and compliance planning,
testing strategy, architecture planning.

Development (7 to 16): project structure planning, infrastructure guidelines,
compute selection, database and storage planning, networking and load
balancing, observability stack planning, CI/CD planning, disaster recovery
planning, cost optimization and FinOps, performance and optimization planning.

Operations (17 to 22): UAT and pilot, final validations, end-user training
and change management, launch checklist, post-launch operations,
decommissioning and retirement.

The documentation index linked in the map is the canonical list with paths.
Each guide carries its own prerequisites and cross-references; read the index
first and the one guide the task needs second.

## Documentation is gated like code

The template's docs pass a deterministic gate before merge: per-document
token budgets, required fields on decision records, reachable from an index,
no broken links. A document nothing links to is guidance no agent loads. That
gate is why the map above is short: it links to indexes, and the indexes link
to everything else. The gate itself is a capability the organization pins in
`org.json`, not a zone here.
