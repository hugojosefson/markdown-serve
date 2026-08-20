import { Language, Parser } from "web-tree-sitter";
import { core } from "./wasms.js";

let engine: Promise<void> | undefined;
let binding: EmscriptenBinding | undefined;

/** Initializes from source-phase imports, never asking Emscripten to read its cache. */
export function initializeSymbols(): Promise<void> {
  engine ??= Parser.init({
    instantiateWasm(
      imports: WebAssembly.Imports,
      receiveInstance: (
        instance: WebAssembly.Instance,
        module: WebAssembly.Module,
      ) => void,
    ) {
      WebAssembly.instantiate(core, imports).then((result) =>
        receiveInstance("instance" in result ? result.instance : result, core)
      );
      return {};
    },
    onRuntimeInitialized(this: EmscriptenBinding) {
      binding = this;
    },
  });
  return engine;
}

export async function loadLanguage(
  module: WebAssembly.Module,
): Promise<Language> {
  await initializeSymbols();
  if (!binding) {
    throw new Error("Tree-sitter binding did not initialize");
  }
  const runtime = binding;
  // web-tree-sitter only accepts bytes in Language.load. Source-phase imports
  // deliberately expose modules, so use its pinned Emscripten loader instead.
  const exports = await runtime.loadWebAssemblyModule(module, {
    loadAsync: true,
  });
  const address = Object.entries(exports).find(([name]) =>
    /^tree_sitter_\w+$/.test(name) && !name.includes("external_scanner")
  )?.[1] as (() => number) | undefined;
  if (!address) {
    throw new Error("Tree-sitter language has no entry point");
  }
  const language = Object.create(Language.prototype) as Language & {
    [key: number]: number;
  };
  language[0] = address();
  language.types = Array.from(
    { length: runtime._ts_language_symbol_count(language[0]) },
    (_, index) =>
      runtime._ts_language_symbol_type(language[0], index) < 2
        ? runtime.UTF8ToString(
          runtime._ts_language_symbol_name(language[0], index),
        )
        : "",
  );
  language.fields = Array.from(
    { length: runtime._ts_language_field_count(language[0]) + 1 },
    (_, index) => {
      const pointer = runtime._ts_language_field_name_for_id(
        language[0],
        index,
      );
      return pointer ? runtime.UTF8ToString(pointer) : null;
    },
  );
  return language;
}

type EmscriptenBinding = {
  loadWebAssemblyModule(
    module: WebAssembly.Module,
    options: { loadAsync: boolean },
  ): Promise<Record<string, unknown>>;
  _ts_language_field_count(address: number): number;
  _ts_language_field_name_for_id(address: number, index: number): number;
  _ts_language_symbol_count(address: number): number;
  _ts_language_symbol_name(address: number, index: number): number;
  _ts_language_symbol_type(address: number, index: number): number;
  UTF8ToString(pointer: number): string;
};
