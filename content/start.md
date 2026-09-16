## The config file

Gather from the owner which repositories to use, then write ~/.config/agent-sop/config.toml:

    schema_version = 1

    [repos]
    org   = "owner/org-repo@ref"
    sop   = "owner/sop-repo@ref"
    comms = "owner/comms-repo@ref"

`org` is required. `sop` may be omitted when org.json in the org repository pins it. `comms` is optional. No secrets go in this file.
