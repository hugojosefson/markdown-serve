import { getLanguageByFileName } from "file-lang-map";

const linguistLanguages: Readonly<Record<string, string>> = {
  "c": "c",
  "c#": "csharp",
  "c++": "cpp",
  "css": "css",
  "editorconfig": "ini",
  "git config": "ini",
  "go": "go",
  "hcl": "hcl",
  "html": "markup",
  "ini": "ini",
  "java": "java",
  "javascript": "javascript",
  "json": "json",
  "json5": "json5",
  "jsx": "jsx",
  "markdown": "markdown",
  "python": "python",
  "rust": "rust",
  "shell": "bash",
  "svg": "markup",
  "toml": "toml",
  "tsx": "tsx",
  "typescript": "typescript",
  "xml": "markup",
  "yaml": "yaml",
};

export function knownPathLanguage(path: string): string | undefined {
  const normalizedPath = path.replaceAll("\\", "/").replace(/\/{2,}/g, "/");
  const comparablePath = normalizedPath.toLowerCase();
  if (
    comparablePath.endsWith("/.git/config") || comparablePath === ".git/config"
  ) {
    return "ini";
  }
  return getLanguageByFileName(normalizedPath)
    ?.map((language) => linguistLanguages[language.toLowerCase()])
    .find((language) => language !== undefined);
}
