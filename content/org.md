## What the org repository answers

`org.json` at the root of an org repository is the one file an agent reads to
resolve names. Version 1 has three parts:

- `organization`: a stable id, the GitHub account that owns the instance
  repositories, and the path of the organization profile.
- `sources.sop`: the SOP instance repository at a commit, with the file to
  read first.
- `capabilities`: a map from a kebab-case name to a repository, a commit, an
  entry file, and a one-line summary. The name is what procedures use; the
  repository can move without procedures changing.

Every `ref` is a 40-character commit SHA. A tag or a branch is a validation
error, because only a commit cannot move underneath a reader.

## The governance data

Three files under `governance/` describe the fleet. The template ships each
with example values and a validator; an instance replaces the values.

- `repos.json` is the governed-scope manifest: each repository's visibility,
  whether it publishes, whether it consumes shared CI, and the delta it
  records against the shared procedures. A generated table in `docs/` is its
  human-readable view.
- `agents.json` is the roster of GitHub App identities: one App per harness,
  each `active` or `retired`.
- `organization-profile.json` is the secret-free projection that bootstrap
  tooling reads to learn the organization id, the account, and the default
  bot identity per harness.

## Staying aligned with the template

An instance records the template commit it was created from and adopts a
newer one by a reviewed pull request that says which upstream commit it took.
The template never writes to an instance. Validation (`npm run check` in the
template and in every instance) is the only mechanism shared between them.
