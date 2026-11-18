#!/usr/bin/env python3
"""Diagnostic-only markdown 1.0.0 EditMap experiment. Pass crate directory."""
import pathlib, sys
root = pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else next((pathlib.Path.home()/'.cargo/registry/src').glob('*/markdown-1.0.0'))
p = root / 'src/util/edit_map.rs'
s = p.read_text()
old = '''    while index < edit_map.map.len() {
        if edit_map.map[index].0 == at {
            edit_map.map[index].1 += remove;

            if before {
                add.append(&mut edit_map.map[index].2);
                edit_map.map[index].2 = add;
            } else {
                edit_map.map[index].2.append(&mut add);
            }

            return;
        }

        index += 1;
    }

    edit_map.map.push((at, remove, add));'''
new = '''    if let Some(&index) = edit_map.index.get(&at) {
        edit_map.map[index].1 += remove;
        if before {
            add.append(&mut edit_map.map[index].2);
            edit_map.map[index].2 = add;
        } else {
            edit_map.map[index].2.append(&mut add);
        }
        return;
    }
    edit_map.index.insert(at, edit_map.map.len());
    edit_map.map.push((at, remove, add));'''
repls = [
 ('use alloc::{vec, vec::Vec};','use alloc::{collections::BTreeMap, vec, vec::Vec};'),
 ('    map: Vec<(usize, usize, Vec<Event>)>,','    map: Vec<(usize, usize, Vec<Event>)>,\n    index: BTreeMap<usize, usize>,'),
 ('        EditMap { map: vec![] }','        EditMap { map: vec![], index: BTreeMap::new() }'),
 ('        self.map.truncate(0);','        self.map.truncate(0);\n        self.index.clear();'),
 ('    let mut index = 0;\n\n    if remove == 0 && add.is_empty()', '    if remove == 0 && add.is_empty()'),
 (old,new),
]
for a,b in repls:
    if s.count(a)!=1: raise SystemExit(f'Unexpected source: target count {s.count(a)} for {a[:65]!r}')
    s=s.replace(a,b,1)
p.write_text(s)
print('Patched diagnostic crate:',p)
