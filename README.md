# CorporateBench Biocure — Curiosity Engine wiki

Interactive atlas / wiki viewer for the Biocure CorporateBench tranche curated with [Curiosity Engine](https://github.com/benjsmith/curiosity-engine).

**Live site:** https://benjsmith.github.io/corporatebench-biocure-wiki/

## Downloads

| Archive | Size | Link |
|---------|------|------|
| **Wiki + vault (combined)** | ~102 MB | [biocure-wiki-vault-76142912.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/biocure-wiki-vault-76142912.tar.gz) |
| Wiki only | ~14 MB | [wiki-hybrid-76142912.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/wiki-hybrid-76142912.tar.gz) |
| Vault only | ~88 MB | [vault.tar.gz](https://github.com/benjsmith/corporatebench-biocure-wiki/releases/download/v1.0.0-hybrid-76142912/vault.tar.gz) |

On the live site: [Downloads](https://benjsmith.github.io/corporatebench-biocure-wiki/downloads.html)

## What’s here

| Path | Contents |
|------|----------|
| `/` | Static CE wiki viewer + Knowledge Atlas (`data.json.gz`, 39 192 pages) |
| [Releases](https://github.com/benjsmith/corporatebench-biocure-wiki/releases) | Frozen wiki + vault tarballs |

## Snapshot

- **Wiki tip:** `hybrid-sql-scalars` @ `76142912` (pin-restored hybrid QUERY branch)
- **Pages:** ~39 192 · **WikiLinks:** ~122 341 edges
- **Vault:** CorporateBench Biocure sources (see Release assets)

## Notes

- Edit / vault-upload buttons need a local `viewer.sh` server; they are inactive on GitHub Pages.
- Atlas index is ultra-slim `data.json.gz` (~0.8 MB gz / ~8 MB inflate: all node titles + 2k sampled edges; no page bodies). Full HTML is in `bodies/NN.json.gz` shards loaded when you open a page.

## License

Research snapshot for the CE × CorporateBench paper. Source corpus rights remain with CorporateBench / original publishers.
