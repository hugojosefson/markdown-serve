// deno-lint-ignore-file no-import-prefix -- source-phase WASM needs npm subpaths.
import source core from "npm:web-tree-sitter@0.25.10/tree-sitter.wasm";
import source bash from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-bash.wasm";
import source c from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-c.wasm";
import source cpp from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-cpp.wasm";
import source csharp from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-c_sharp.wasm";
import source go from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-go.wasm";
import source java from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-java.wasm";
import source javascript from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-javascript.wasm";
import source python from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-python.wasm";
import source rust from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-rust.wasm";
import source typescript from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-typescript.wasm";
import source tsx from "npm:tree-sitter-wasms@0.1.13/out/tree-sitter-tsx.wasm";

export {
  bash,
  c,
  core,
  cpp,
  csharp,
  go,
  java,
  javascript,
  python,
  rust,
  tsx,
  typescript,
};
