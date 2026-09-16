## Loading rules

- Load a skill only when the governing procedure names it. The catalog is
  not a preload list.
- Resolve the name through the organization's `org.json` and read the skill
  at the commit it pins. A `main` link in a capability map is a validation
  error.
- Read the skill's own `SKILL.md` for installation. Externally owned skills
  install per their owning repository, not per any catalog.
- Treat any script a skill ships as supply chain: no secrets, no network
  fetch of unpinned code, least privilege.

## One home, no copies

A skill either lives in the template repository under `skills/<name>/` or
lives in the repository that owns its domain and is cataloged by link. It is
never copied into another tree. Skills that live in the template are
installed by symlink, so a pull updates every machine instead of letting
copies drift.

## Capabilities are named, not routed

Shared CI, the docs gate, the dependency inventory, the AI primitives, and an
identity runtime are capabilities: each is one repository with one mechanism.
An organization pins each in the `capabilities` map of its `org.json`. A
procedure refers to a capability by that name; the router never gives a
capability a zone, so adding or replacing one is a change in the org
repository, not here.

## Adding a skill

1. `skills/<name>/SKILL.md` with `name` and `description` frontmatter. The
   description is the whole trigger; it must say when to use the skill.
2. Link it from the shared skills index. The docs gate fails a skill that no
   index reaches.
3. Stay inside the per-document token budget. A skill that needs more is
   usually two skills.
4. State what an agent cannot derive from code or existing docs, and link
   rather than restate.
