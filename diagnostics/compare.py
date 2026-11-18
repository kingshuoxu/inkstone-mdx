import json,pathlib,statistics
root=pathlib.Path('diagnostics')
summary={}
for variant in ['baseline','indexed']:
 rs=[json.loads(p.read_text()) for p in root.glob(f'result-{variant}-rich-5242880-*.json')]
 assert len(rs)==3
 summary[variant]={
 'total_ready_ms':[r['readyReceived']-r['started'] for r in rs],
 'compile_ms':[r['compileMs'] for r in rs],
 'parse_ms':[r['rustStages'][1]['at']-r['rustStages'][0]['at'] for r in rs],
 'code_hashes':list(set(r['codeHash'] for r in rs)),
 'nodes':list(set(r['counts']['nodes'] for r in rs))}
assert summary['baseline']['code_hashes']==summary['indexed']['code_hashes']
assert summary['baseline']['nodes']==summary['indexed']['nodes']
for p in root.glob('result-baseline-*.json'):
 q=root/p.name.replace('baseline','indexed')
 assert json.loads(p.read_text())['codeHash']==json.loads(q.read_text())['codeHash']
(root/'comparison.json').write_text(json.dumps(summary,indent=2))
print('A_B_COMPARISON',json.dumps(summary))
