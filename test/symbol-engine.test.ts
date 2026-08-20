import { assert, assertEquals } from "@std/assert";
import { analyzeSymbols } from "../src/server/symbols/analyze.ts";
import { loadLanguage } from "../src/server/symbols/engine.ts";
import { bash } from "../src/server/symbols/wasms.js";

Deno.test("symbol engine loads source-phase WASM without filesystem permissions", async () => {
  assert(await loadLanguage(bash));
});

Deno.test("structural symbols cover every meaningful highlighted language", async () => {
  const fixtures: Record<string, { source: string; names: string[] }> = {
    bash: {
      source: "build() { echo ok; }\n",
      names: ["build"],
    },
    c: {
      source:
        "int add(int a, int b) { return a + b; }\nstruct Point { int x; };\nunion Value { int i; };\nenum Color { RED };\ntypedef int Size;\n",
      names: ["add", "Point", "Value", "Color", "Size"],
    },
    cpp: {
      source:
        "namespace app {\nusing Size = int;\nclass Widget {\npublic:\n  void run() {}\n};\n}\n",
      names: ["app", "Size", "Widget", "run"],
    },
    csharp: {
      source:
        "namespace App {\ndelegate void Handler();\nrecord Item(int Id);\nclass Service {\n  Service() {}\n  void Run() {}\n}\n}\n",
      names: ["App", "Handler", "Item", "Service", "Service", "Run"],
    },
    go: {
      source:
        "package main\ntype Item struct{}\nfunc Build() {}\nfunc (Item) Run() {}\n",
      names: ["Item", "Build", "Run"],
    },
    java: {
      source:
        "@interface Marker {}\nclass Service {\n  Service() {}\n  void run() {}\n}\nrecord Item(int id) {}\n",
      names: ["Marker", "Service", "Service", "run", "Item"],
    },
    javascript: {
      source:
        "function build() {}\nfunction* stream() {}\nclass Service { run() {} }\n",
      names: ["build", "stream", "Service", "run"],
    },
    jsx: {
      source: "function View() { return <main />; }\n",
      names: ["View"],
    },
    python: {
      source:
        "def build():\n    pass\nclass Service:\n    def run(self):\n        pass\n",
      names: ["build", "Service", "run"],
    },
    rust: {
      source:
        "fn build() {}\nstruct Item;\nenum Kind { A }\ntrait Work {}\nunion Value { i: i32 }\nmod inner {}\ntype Size = usize;\n",
      names: ["build", "Item", "Kind", "Work", "Value", "inner", "Size"],
    },
    typescript: {
      source:
        "interface Item {}\ntype Size = number;\nenum Kind { A }\nnamespace App {}\nabstract class Service { abstract run(): void; }\nfunction* stream() {}\nfunction build() {}\n",
      names: [
        "Item",
        "Size",
        "Kind",
        "App",
        "Service",
        "run",
        "stream",
        "build",
      ],
    },
    tsx: {
      source:
        "interface Props {}\nfunction View(props: Props) { return <main />; }\n",
      names: ["Props", "View"],
    },
  };
  for (const [language, fixture] of Object.entries(fixtures)) {
    const analysis = await analyzeSymbols(fixture.source, language);
    assertEquals(
      analysis?.occurrences.map(({ name }) => name),
      fixture.names,
      language,
    );
  }
});

Deno.test("symbol anchors are unique, Unicode-safe, and fragment-correct", async () => {
  const unique = await analyzeSymbols(
    "function café() {}\nfunction $build() {}\n",
    "javascript",
  );
  assertEquals(
    unique?.occurrences.map(({ name, id, href }) => ({ name, id, href })),
    [
      { name: "café", id: "symbol-café", href: "#symbol-caf%C3%A9" },
      { name: "$build", id: "symbol-$build", href: "#symbol-%24build" },
    ],
  );
  const duplicates = await analyzeSymbols(
    "function same() {}\nfunction same() {}\n",
    "javascript",
  );
  assertEquals(
    duplicates?.occurrences.map(({ id, href }) => ({ id, href })),
    [{ id: undefined, href: "#L1" }, { id: undefined, href: "#L2" }],
  );
});

Deno.test("symbol analysis skips unsupported and files above one MiB", async () => {
  assertEquals(await analyzeSymbols("a {}", "css"), undefined);
  assertEquals(
    await analyzeSymbols(
      `${" ".repeat(1024 * 1024)}function tooLarge() {}`,
      "javascript",
    ),
    undefined,
  );
});
