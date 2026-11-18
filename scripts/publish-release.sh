#!/usr/bin/env bash
set -euo pipefail
TAG=v0.1.0
REPO="$GITHUB_REPOSITORY"
SHA="$GITHUB_SHA"
test "$(node -p "require('./package.json').version")" = "${TAG#v}"
# Require both ordinary quality workflows on this exact source commit, not an older green run.
for attempt in $(seq 1 120); do
  gh api "repos/$REPO/actions/runs?head_sha=$SHA&per_page=100" > /tmp/release-runs.json
  state=$(python3 - <<'PY'
import json
runs=json.load(open('/tmp/release-runs.json'))['workflow_runs']
chosen=[]
for name in ['Verify','Desktop']:
    a=[r for r in runs if r['name']==name and r['event']=='push']
    if not a: print('wait'); break
    chosen.append(max(a,key=lambda r:r['id']))
else:
    if any(r['status']=='completed' and r['conclusion']!='success' for r in chosen): print('failed')
    elif all(r['status']=='completed' for r in chosen): print('success')
    else: print('wait')
PY
)
  if [ "$state" = success ]; then break; fi
  if [ "$state" = failed ]; then echo "Same-commit quality workflow failed"; exit 1; fi
  sleep 15
done
test "$state" = success
mkdir -p release-assets
python3 - <<'PY'
import pathlib,hashlib,json,os,shutil
root=pathlib.Path('release-artifacts'); out=pathlib.Path('release-assets')
files=[p for p in root.rglob('*') if p.is_file() and p.suffix in {'.AppImage','.deb','.exe','.dmg','.zip'}]
assert len(files)==7, [(str(p),p.stat().st_size) for p in files]
assert len({p.name for p in files})==7, 'duplicate artifact names'
records=[]
for p in sorted(files,key=lambda p:p.name):
    assert p.stat().st_size>1000000, str(p)
    dest=out/p.name;shutil.copyfile(p,dest)
    records.append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={'version':'0.1.0','tag':'v0.1.0','commit':os.environ['GITHUB_SHA'],'release_workflow_run':os.environ['GITHUB_RUN_ID'],'unsigned':True,'macos_notarized':False,'assets':records}
(out/'BUILD-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
with (out/'SHA256SUMS.txt').open('w') as f:
    for p in sorted(out.iterdir()):
        if p.name!='SHA256SUMS.txt': f.write(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n')
PY
if gh api "repos/$REPO/git/ref/tags/$TAG" > /tmp/release-tag.json 2>/dev/null; then
  test "$(gh api "repos/$REPO/commits/$TAG" --jq .sha)" = "$SHA"
else
  gh api --method POST "repos/$REPO/git/refs" -f ref="refs/tags/$TAG" -f sha="$SHA"
fi
if gh release view "$TAG" --repo "$REPO" --json isDraft > /tmp/release-existing.json 2>/dev/null; then
  test "$(python3 -c "import json;print(json.load(open('/tmp/release-existing.json'))['isDraft'])")" = True
else
  gh release create "$TAG" --repo "$REPO" --verify-tag --draft --title "Inkstone MDX v0.1.0" --notes-file docs/releases/v0.1.0.md
fi
gh release upload "$TAG" release-assets/* --repo "$REPO" --clobber
mkdir -p downloaded-release
gh release download "$TAG" --repo "$REPO" --dir downloaded-release
(cd downloaded-release && sha256sum --check SHA256SUMS.txt)
test "$(find downloaded-release -maxdepth 1 -type f | wc -l)" -eq 9
test "$(gh api "repos/$REPO/commits/$TAG" --jq .sha)" = "$SHA"
gh release edit "$TAG" --repo "$REPO" --draft=false --prerelease=false --latest
gh release view "$TAG" --repo "$REPO" --json url,isDraft,isPrerelease,assets
