// Deterministic reproduction inspired by https://github.com/wooorm/markdown-rs/issues/113.
// Input generation and AST formatting/hash are excluded from the parse timer.
use std::hash::{Hash, Hasher};
use std::time::Instant;
fn main() {
    for kind in ["issue113-mdx", "issue113-plain", "rich-blocks"] {
        for size in [1usize, 2, 4, 8] {
            let mut source=String::new();
            if kind == "rich-blocks" {
                source="# Heading\n\n**bold** *italic* ~~strike~~ [link](https://example.com)\n\n".repeat(size*2000);
            } else {
                for block in 0..size {
                    if kind == "issue113-mdx" { source.push_str("\n<DummyComponent code={`\n"); }
                    for row in 0..10000 { source.push_str(&format!("{:08x}-1234-4567-89ab-{:012x}\n",row,block*10000+row)); }
                    if kind == "issue113-mdx" { source.push_str("`}/>\n\n"); }
                }
            }
            let options=if kind == "issue113-mdx" { markdown::ParseOptions::mdx() }
                else if kind == "rich-blocks" { markdown::ParseOptions::gfm() }
                else { markdown::ParseOptions::default() };
            for run in 0..3 {
                let start=Instant::now();
                let tree=markdown::to_mdast(&source,&options).expect("valid fixture");
                let ms=start.elapsed().as_secs_f64()*1000.0;
                let mut hash=std::collections::hash_map::DefaultHasher::new();
                format!("{:?}",tree).hash(&mut hash);
                println!("SCALING {{\"kind\":\"{}\",\"size\":{},\"bytes\":{},\"run\":{},\"parse_ms\":{},\"ast_hash\":\"{:016x}\"}}",kind,size,source.len(),run,ms,hash.finish());
            }
        }
    }
}
