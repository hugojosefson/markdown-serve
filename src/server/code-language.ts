import { knownPathLanguage } from "./known-path-language.ts";

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
  ini: "ini",
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
  "ini",
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

export function codeLanguageForPath(path: string, content = ""): string {
  const extension = path.replaceAll("\\", "/").split("/").at(-1)?.split(".").at(
    -1,
  )
    ?.toLowerCase();
  const extensionLanguage = extension ? codeLanguage(extension) : "text";
  if (extensionLanguage !== "text") {
    return extensionLanguage;
  }
  return knownPathLanguage(path) ??
    codeLanguageForShebang(content) ?? "text";
}

export function codeLanguageForShebang(
  content: string,
): string | undefined {
  const line = content.split(/\r?\n/, 1)[0];
  if (!line.startsWith("#!")) {
    return undefined;
  }
  const command = shebangCommand(line.slice(2));
  if (!command) {
    return undefined;
  }
  const [interpreter, ...args] = command;
  if (/^(?:(?:ba|da|k|mk|z)?sh)$/.test(interpreter)) {
    return "bash";
  }
  if (/^(?:python|pypy)(?:\d+(?:\.\d+)*)?$/.test(interpreter)) {
    return "python";
  }
  if (/^(?:node|nodejs|bun)$/.test(interpreter)) {
    return "javascript";
  }
  if (/^(?:ts-node|tsx)$/.test(interpreter)) {
    return "typescript";
  }
  if (interpreter === "deno") {
    const extension = optionValue(args, "--ext");
    return extension === "js" || extension === "jsx"
      ? "javascript"
      : "typescript";
  }
  return undefined;
}

function shebangCommand(value: string): string[] {
  const parts = splitCommand(value);
  const executable = basename(parts.shift());
  if (executable !== "env") {
    return executable ? [executable, ...parts] : [];
  }
  while (parts.length) {
    const part = parts.shift()!;
    if (part === "-S" || part === "--split-string") {
      continue;
    }
    if (["-u", "--unset", "-C", "--chdir"].includes(part)) {
      parts.shift();
      continue;
    }
    if (part.startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(part)) {
      continue;
    }
    return [basename(part), ...parts];
  }
  return [];
}

function splitCommand(value: string): string[] {
  const parts: string[] = [];
  let part = "";
  let quote = "";
  let escaped = false;
  for (const character of value.trim()) {
    if (escaped) {
      part += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) {
        quote = "";
      } else {
        part += character;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (part) {
        parts.push(part);
        part = "";
      }
    } else {
      part += character;
    }
  }
  if (escaped) {
    part += "\\";
  }
  if (part) {
    parts.push(part);
  }
  return parts;
}

function basename(value: string | undefined): string {
  return value?.split("/").at(-1)?.toLowerCase() ?? "";
}

function optionValue(args: string[], option: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${option}=`));
  if (inline) {
    return inline.slice(option.length + 1).toLowerCase();
  }
  const index = args.indexOf(option);
  return index < 0 ? undefined : args[index + 1]?.toLowerCase();
}
