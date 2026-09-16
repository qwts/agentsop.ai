## What each file answers

- org.json: which SOP repository and which capabilities, each at one commit. Read it before any other file here.
- governance/agents.json: which bot identity belongs to which harness, and whether it is active.
- governance/repos.json: which repositories the procedures govern and what each one varies.
- governance/organization-profile.json: what a new machine needs to know, without secrets.

## When something is missing

- No config file: go to https://agentsop.ai/start/llms.txt; do not guess an organization.
- The org repository is unreadable: report the pointer and the error; do not fall back to another organization.
- org.json fails validation: report it; do not repair it from memory.
- A capability a procedure names is not in org.json: report which side names it and stop at that step.
