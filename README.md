# CorporateBench Biocure — Curiosity Engine wiki

Interactive atlas / wiki viewer for the Biocure CorporateBench tranche curated with [Curiosity Engine](https://github.com/benjsmith/curiosity-engine).

**Live site:** https://benjsmith.github.io/corporatebench-biocure-wiki/

## Live Atlas

The GitHub Pages Atlas now serves **deepened repair-v18** @ `17c5f72` (hub synthesis after scrub `0401aa6`; thin scrubbed analyses expanded into wiki-style synthesis). Tip SHA `17c5f72a19c7c583e33d5166445706f70ed06e1a`.

## Downloads

Tarball links below are the **previous hybrid snapshot** (`hybrid-sql-scalars` @ `76142912`) kept so existing release URLs keep working. A repair-v18 release tarball is optional / not required for this Pages content swap.

| Archive | Size | Link |
|--------|------|------|
| **Wiki + vault (combined)** — previous hybrid | ~102 MB | [biocure-wiki-vault-76142912.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/biocure-wiki-vault-76142912.tar.gz) |
| Wiki only — previous hybrid | ~14 MB | [wiki-hybrid-76142912.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/wiki-hybrid-76142912.tar.gz) |
| Vault only — previous hybrid | ~88 MB | [vault.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/vault.tar.gz) |

On the live site: [Downloads](https://benjsmith.github.io/corporatebench-biocure-wiki/downloads.html)

## What’s here

| Path | Contents |
|------|----------|
| `/` | Static CE wiki viewer + Knowledge Atlas (`data.json.gz`, ~27 197 pages) |
| [Releases](https://github.com/benjsmith/corporatebench-biocure-wiki/releases) | Frozen wiki + vault tarballs (hybrid snapshot still published) |

## Snapshot

- **Wiki tip (live Atlas):** deepened `repair-v18` @ `17c5f72` (hub synthesis after scrub)
- **Pages:** ~27 197 · **WikiLinks:** ~12 258 edges
- **Vault:** CorporateBench Biocure sources (static shards on Pages; full vault also in Release assets)
- **Viewer lineage:** Pages static keeps Atlas-only >1k, edges mode pill, sticky selection (CE #11–#13), mobile doc modal + portrait sidebar (`82d6e66`)

## Notes

- Edit / vault-upload buttons need a local `viewer.sh` server; they are inactive on GitHub Pages.
- Atlas index is slim `data.json.gz` (nodes + page stubs). Page bodies load on demand from `bodies/*.json.gz`. WikiLinks: full `edges.json.gz` is **preloaded before layout**; edge *strokes* show when roughly ≤1k nodes are in view.

## License

Research snapshot for the CE × CorporateBench paper. Source corpus rights remain with CorporateBench / original publishers.
