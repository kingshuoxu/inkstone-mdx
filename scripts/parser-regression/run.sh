#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=${PARSER_REGRESSION_OUTPUT:-"$ROOT/docs/parser-regression"}
mkdir -p "$OUT"
TMP=$(mktemp -d)
# Immutable release source includes the tests intentionally omitted from crates.io.
COMMIT=1506572f9b406431402928f3a8b3df0b4ae2d8f5
curl --fail --location --retry 3 "https://codeload.github.com/wooorm/markdown-rs/tar.gz/$COMMIT" -o "$TMP/upstream.tar.gz"
echo "605a416c8431d6e65a2f2b1c94d68f0f9aba3c9d94d732517ca3d45e4e54115a  $TMP/upstream.tar.gz" | sha256sum --check
tar xzf "$TMP/upstream.tar.gz" -C "$TMP"
mv "$TMP/markdown-rs-$COMMIT" "$TMP/original"
cp -a "$TMP/original" "$TMP/patched"
# Validate that the product vendor differs from the exact release only in the reviewed optimization.
diff -qr "$TMP/original/src" "$ROOT/core/vendor/markdown/src" > "$OUT/vendor-source-diff.txt" || true
python3 - "$OUT/vendor-source-diff.txt" <<'PY'
import pathlib,sys
lines=pathlib.Path(sys.argv[1]).read_text().splitlines()
assert len(lines)==1 and '/util/edit_map.rs ' in lines[0], lines
PY
cp "$ROOT/core/vendor/markdown/src/util/edit_map.rs" "$TMP/patched/src/util/edit_map.rs"
python3 "$ROOT/scripts/parser-regression/inject-edit-map-tests.py" "$TMP/patched" "$TMP/original"
for variant in original patched; do
  # swc_core 22 expects pre-1.0.220 serde internals; pin only the historical test harness.
  sed -i 's/optional = true, version = "1"/optional = true, version = "=1.0.219"/' "$TMP/$variant/Cargo.toml"
  sed -i 's/serde_json = { version = "1" }/serde_json = { version = "=1.0.140" }/' "$TMP/$variant/Cargo.toml"
  mkdir -p "$TMP/$variant/examples"
  cp "$ROOT/scripts/parser-regression/index_scaling.rs" "$TMP/$variant/examples/"
done
cargo test --manifest-path "$TMP/patched/Cargo.toml" -p markdown --all-features 2>&1 | tee "$OUT/upstream-tests.log"
for variant in original patched; do
  cargo run --release --manifest-path "$TMP/$variant/Cargo.toml" -p markdown --example index_scaling 2>&1 | tee "$OUT/scaling-$variant.log"
done
python3 "$ROOT/scripts/parser-regression/compare-scaling.py" "$OUT"
