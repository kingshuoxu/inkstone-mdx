# Vendored parser

`markdown/` is markdown-rs 1.0.0, distributed under its included MIT license.
Upstream: https://github.com/wooorm/markdown-rs/tree/1506572f9b406431402928f3a8b3df0b4ae2d8f5
Crates.io archive SHA-256: `a5cab8f2cadc416a82d2e783a1946388b31654d391d1c7d92cc1f03e295b1deb`.

The only production source change is `src/util/edit_map.rs`: retain the existing
edit vector and its application order, but index edit positions with a BTreeMap.
This avoids scanning all earlier edits on every insertion. Clear the index after
consumption so the structure can be reused. No grammar, renderer, permissions,
network behavior, preview scheduling, or diagnostic position data is changed.

Cargo's local crates.io patch applies to both direct and transitive dependencies.
It is intentionally reproducible and does not mutate the user's Cargo registry.
Upstream semantic, differential, and scaling checks are run by
`scripts/parser-regression/run.sh` in CI. Remove this patch when an upstream
release with an equivalent fix has passed those checks.
