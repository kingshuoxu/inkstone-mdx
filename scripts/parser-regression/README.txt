Test source provenance:
  markdown-rs tag 1.0.0, commit 1506572f9b406431402928f3a8b3df0b4ae2d8f5
  https://codeload.github.com/wooorm/markdown-rs/tar.gz/1506572f9b406431402928f3a8b3df0b4ae2d8f5
The crates.io package omits upstream tests. Fetch the full upstream source for semantic tests.
1. Copy full source to original/ and patched/.
2. Apply the SAME product edit_map.rs change to patched/.
3. python inject-edit-map-tests.py patched/ original/
4. cargo test --manifest-path patched/Cargo.toml --lib index_regression
5. cargo test --manifest-path patched/Cargo.toml -p markdown --all-features
   (Includes CommonMark, GFM, MDX integration suites and doc tests.)
6. Put index_scaling.rs in original/examples/ and patched/examples/.
7. Run both: cargo run --release --manifest-path CRATE/Cargo.toml -p markdown --example index_scaling
   Capture SCALING JSON lines; compare ast_hash at each kind,size,run across variants.
   Report medians for size=1,2,4,8. Do not conflate this native parser microbenchmark with browser end-to-end performance.
The index differential tests compare every Event's Debug representation against pristine implementation,
including point/name/kind/link fields; deterministic shuffled insert positions, cumulative removals,
repeated prepend+append, no-ops, insertion at end, 32 reuse cycles, and previous/next-link shifts.
