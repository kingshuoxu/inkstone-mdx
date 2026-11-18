#!/usr/bin/env python3
import json, pathlib, statistics, sys
out=pathlib.Path(sys.argv[1]); variants={}
for variant in ('original','patched'):
    rows=[json.loads(l.split('SCALING ',1)[1]) for l in (out/f'scaling-{variant}.log').read_text().splitlines() if l.startswith('SCALING ')]
    assert len(rows)==36, (variant,len(rows))
    variants[variant]={(r['kind'],r['size'],r['run']):r for r in rows}
for key,r in variants['original'].items():
    p=variants['patched'][key]
    assert r['bytes']==p['bytes'] and r['ast_hash']==p['ast_hash'],(key,r,p)
summary=[]
for kind in ('issue113-mdx','issue113-plain','rich-blocks'):
    for size in (1,2,4,8):
        row={'kind':kind,'size':size}
        for variant in variants:
            row[variant+'_parse_median_ms']=statistics.median(variants[variant][kind,size,run]['parse_ms'] for run in range(3))
        summary.append(row)
(out/'scaling-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print('Verified all 36 AST hashes match; native parse medians:',json.dumps(summary))
