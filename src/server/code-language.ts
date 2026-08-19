const aliases: Readonly<Record<string, string>> = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  cjs: "javascript",
  cs: "csharp",
  cts: "typescript",
  css: "css",
  go: "go",
  h: "c",
  html: "markup",
  java: "java",
  js: "javascript",
  json: "json",
  json5: "json5",
  jsonc: "json5",
  jsx: "jsx",
  md: "markdown",
  mjs: "javascript",
  mts: "typescript",
  py: "python",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  svg: "markup",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  xml: "markup",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

const languages = new Set([
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "go",
  "java",
  "javascript",
  "json",
  "json5",
  "jsx",
  "markdown",
  "markup",
  "python",
  "rust",
  "text",
  "toml",
  "tsx",
  "typescript",
  "yaml",
]);

export function codeLanguage(name?: string): string {
  const candidate =
    name?.split(",")[0]?.trim().split(/\s+/)[0]?.toLowerCase() ||
    "text";
  const language = aliases[candidate] ?? candidate;
  return languages.has(language) ? language : "text";
}

export function codeLanguageForPath(path: string): string {
  const extension = path.split("/").at(-1)?.split(".").at(-1)?.toLowerCase();
  return extension ? codeLanguage(extension) : "text";
}
