# CorporateBench Biocure — Curiosity Engine wiki

Interactive atlas / wiki viewer for the Biocure CorporateBench tranche curated with [Curiosity Engine](https://github.com/benjsmith/curiosity-engine).

**Live site:** https://benjsmith.github.io/corporatebench-biocure-wiki/

## Live Atlas

The GitHub Pages Atlas now serves **confirm-v1** @ `fc1bc3c9d` (K*, CURATE-complete confirmatory tip; 100% unique vault cites). Tip SHA `fc1bc3c9d15210d2be21c2408abfbc3f891b7a25`.

## Downloads

Tarball links below are the **previous hybrid snapshot** (`hybrid-sql-scalars` @ `76142912`) kept so existing release URLs keep working. A confirm-v1 wiki-only release may be attached separately; full vault tarball is optional given size.

| Archive | Size | Link |
|--------|------|------|
| **Wiki + vault (combined)** — previous hybrid | ~102 MB | [biocure-wiki-vault-76142912.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/biocure-wiki-vault-76142912.tar.gz) |
| Wiki only — previous hybrid | ~14 MB | [wiki-hybrid-76142912.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/wiki-hybrid-76142912.tar.gz) |
| Vault only — previous hybrid | ~88 MB | [vault.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/vault.tar.gz) |

On the live site: [Downloads](https://benjsmith.github.io/corporatebench-biocure-wiki/downloads.html)

## What’s here

| Path | Contents |
|------|----------|
| `/` | Static CE wiki viewer + Knowledge Atlas (`data.json.gz`, ~28 829 pages) |
| [Releases](https://github.com/benjsmith/corporatebench-biocure-wiki/releases) | Frozen wiki + vault tarballs (hybrid snapshot still published) |

## Snapshot

- **Wiki tip (live Atlas):** `confirm-v1` @ `fc1bc3c9d` (CURATE-complete; 100% unique vault cites)
- **Pages:** ~28 829 · **WikiLinks:** ~31 476 edges
- **Vault:** CorporateBench Biocure sources (static shards on Pages; full vault also in prior Release assets)
- **Viewer lineage:** Pages static keeps Atlas-only >1k, edges mode pill, sticky selection (CE #11–#13), mobile doc modal + portrait sidebar (`82d6e66`)

## Notes

- Edit / vault-upload buttons need a local `viewer.sh` server; they are inactive on GitHub Pages.
- Atlas index is slim `data.json.gz` (nodes + page stubs). Page bodies load on demand from `bodies/*.json.gz`. WikiLinks: full `edges.json.gz` is **preloaded before layout**; edge *strokes* show when roughly ≤1k nodes are in view.

## License

Research snapshot for the CE × CorporateBench paper. Source corpus rights remain with CorporateBench / original publishers.
