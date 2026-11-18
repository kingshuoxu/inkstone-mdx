#!/usr/bin/env python3
"""Inject cfg(test)-only differential tests. Usage: PATCHED_CRATE ORIGINAL_CRATE."""
from pathlib import Path
import sys
patched, original = map(Path, sys.argv[1:])
source = (original/'src/util/edit_map.rs').read_text()
source = '\n'.join(line for line in source.splitlines() if not line.startswith('//!'))
p = patched/'src/util/edit_map.rs'
assert 'mod index_regression' not in p.read_text()
tests = r'''
#[cfg(test)]
mod index_regression {
    use super::EditMap;
    use crate::event::{Content, Event, Kind, Link, Name, Point};
    use alloc::{format, vec, vec::Vec};
    mod reference { ORIGINAL }
    fn event(id: usize) -> Event {
        Event { kind: Kind::Enter, name: Name::Data,
            point: Point { line: 1, column: id + 1, index: id, vs: 0 }, link: None }
    }
    fn equal(a: &[Event], b: &[Event]) { assert_eq!(format!("{:?}",a), format!("{:?}",b)); }
    #[test]
    fn indexed_matches_original_randomized_and_reused() {
        let mut a = EditMap::new(); let mut b = reference::EditMap::new();
        let mut rng = 123456789u64;
        for cycle in 0..32 {
            let mut x: Vec<_> = (0..260).map(event).collect(); let mut y = x.clone();
            let mut order: Vec<usize> = (0..64).collect();
            for i in (1..order.len()).rev() {
                rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
                order.swap(i, (rng as usize) % (i+1));
            }
            for (j, slot) in order.iter().enumerate() {
                let at = slot * 4; let id = 1000 + cycle * 1000 + j * 10;
                a.add(at, 1, vec![event(id)]); b.add(at, 1, vec![event(id)]);
                a.add_before(at, 0, vec![event(id+1),event(id+2)]);
                b.add_before(at, 0, vec![event(id+1),event(id+2)]);
                a.add(at, 1, vec![event(id+3)]); b.add(at, 1, vec![event(id+3)]);
                a.add_before(at, 0, vec![event(id+4)]); b.add_before(at, 0, vec![event(id+4)]);
                a.add(at+3, 0, vec![]); b.add(at+3, 0, vec![]);
            }
            a.add(260,0,vec![event(999999)]); b.add(260,0,vec![event(999999)]);
            a.consume(&mut x); b.consume(&mut y); equal(&x,&y);
            // Empty consume and reuse check stale index slots after sorting.
            a.consume(&mut x); b.consume(&mut y); equal(&x,&y);
        }
    }
    #[test]
    fn indexed_matches_original_link_shifts_and_removals() {
        let mut x: Vec<_> = (0..20).map(event).collect();
        for i in (0..20).step_by(2) {
            x[i].link = Some(Link { previous: if i==0 {None} else {Some(i-2)},
                next: if i==18 {None} else {Some(i+2)}, content: Content::Text });
        }
        let mut y=x.clone(); let mut a=EditMap::new(); let mut b=reference::EditMap::new();
        for i in [15,3,11,1,17,7,5,13,9,19] {
            a.add(i,1,vec![event(100+i),event(200+i)]);
            b.add(i,1,vec![event(100+i),event(200+i)]);
            a.add_before(i,0,vec![event(300+i)]); b.add_before(i,0,vec![event(300+i)]);
        }
        a.consume(&mut x); b.consume(&mut y); equal(&x,&y);
        for (index,e) in x.iter().enumerate() {
            if let Some(link)=&e.link {
                if let Some(next)=link.next { assert_eq!(x[next].link.as_ref().unwrap().previous,Some(index)); }
            }
        }
    }
}
'''.replace('ORIGINAL', source)
p.write_text(p.read_text()+tests)
print('Injected differential tests:',p)
