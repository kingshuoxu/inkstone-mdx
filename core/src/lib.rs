use markdown::{mdast::Node, Location};
use rustc_hash::FxHashSet;
use swc_core::ecma::{ast::*, codegen::to_code};
use wasm_bindgen::prelude::*;

// Match the JS MDX table transform: whitespace children are invalid in React tables.
fn normalize_tables(node: &mut mdxjs::hast::Node) {
    use mdxjs::hast::Node as H;
    if let H::Element(element) = node {
        if ["table", "thead", "tbody", "tfoot", "tr"].contains(&element.tag_name.as_str()) {
            element.children.retain(|n| !matches!(n, H::Text(t) if t.value.trim().is_empty()));
        }
    }
    if let Some(children) = node.children_mut() { for child in children { normalize_tables(child); } }
}

// Compiles data only. No filesystem, network, JavaScript evaluation or plugin hooks.
fn compile_inner(source: &str, program: bool) -> Result<String, String> {
    if source.len() > 512_000 { return Err("Preview source exceeds 512000 UTF-8 bytes".into()); }
    let options = mdxjs::Options::gfm();
    let tree = mdxjs::mdast_util_from_mdx(source, &options).map_err(|e| e.to_string())?;
    if !program && tree.children().is_some_and(|children| children.iter().any(|n| matches!(n, Node::MdxjsEsm(_)))) {
        return Err("Imports and exports are not supported. Use built-in components or inline JSX.".into());
    }
    let location = Location::new(source.as_bytes());
    let mut explicit = FxHashSet::default();
    let mut html = mdxjs::mdast_util_to_hast(&tree);
    normalize_tables(&mut html);
    let mut output = mdxjs::hast_util_to_swc(&html, &options, Some(&location), &mut explicit).map_err(|e| e.to_string())?;
    mdxjs::mdx_plugin_recma_document(&mut output, &options, Some(&location)).map_err(|e| e.to_string())?;
    mdxjs::mdx_plugin_recma_jsx_rewrite(&mut output, &options, Some(&location), &explicit).map_err(|e| e.to_string())?;
    if program { return Ok(to_code(&output.module)); }
    let mut result = String::from("\"use strict\";\n");
    for item in output.module.body {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::Import(import)) => {
                if import.src.value != *"react/jsx-runtime" { return Err("Unsupported runtime import".into()); }
                let mut fields = vec![];
                for spec in import.specifiers {
                    if let ImportSpecifier::Named(n) = spec {
                        let key = match n.imported { Some(ModuleExportName::Ident(i)) => i.sym.to_string(), None => n.local.sym.to_string(), _ => return Err("Unsupported runtime binding".into()) };
                        fields.push(format!("{}: {}", key, n.local.sym));
                    } else { return Err("Unsupported runtime binding".into()); }
                }
                result.push_str(&format!("const {{{}}} = arguments[0];\n", fields.join(",")));
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(export)) => result.push_str(&format!("return {{default: {}}};\n", to_code(&export.expr))),
            ModuleItem::Stmt(statement) => { result.push_str(&to_code(&statement)); result.push('\n'); }
            _ => return Err("Unsupported module declaration".into()),
        }
    }
    Ok(result)
}

#[wasm_bindgen]
pub fn compile_mdx(source: &str, program: bool) -> Result<String, JsValue> {
    compile_inner(source, program).map_err(|error| JsValue::from_str(&error))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn jsx_expression_gfm_and_unicode() {
        let code = compile_inner("# 中文\n\n<Badge>{1 + 2}</Badge>\n\n~~old~~", false).unwrap();
        assert!(code.contains("中文") && code.contains("Badge") && code.contains("del"));
        assert!(code.contains("return {default:"));
    }
    #[test]
    fn module_policy() {
        assert!(compile_inner("import A from './a.jsx'\n\n<A />", false).is_err());
        assert!(compile_inner("import A from './a.jsx'\n\n<A />", true).unwrap().contains("./a.jsx"));
        assert!(compile_inner("<Broken>", false).is_err());
    }
}
