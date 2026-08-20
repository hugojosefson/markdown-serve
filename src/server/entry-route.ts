import { lexical } from "./paths.ts";
import type { DirectoryEntry } from "./fs.ts";

export type EntryClassification = {
  directory: boolean;
  markdown: boolean;
  index: boolean;
};

export function classifyEntry(
  entry: Pick<DirectoryEntry, "name" | "directory">,
): EntryClassification {
  const markdown = !entry.directory && entry.name.toLowerCase().endsWith(".md");
  return {
    directory: entry.directory,
    markdown,
    index: markdown && /^(readme|index)\.md$/i.test(entry.name),
  };
}

export function entryRoute(
  parts: string[],
  entry: Pick<DirectoryEntry, "name" | "directory">,
): { parts: string[]; trailing: boolean } {
  const classification = classifyEntry(entry);
  if (classification.index) {
    return { parts, trailing: true };
  }
  if (classification.markdown) {
    return { parts: [...parts, entry.name.slice(0, -3)], trailing: false };
  }
  return { parts: [...parts, entry.name], trailing: classification.directory };
}

export function selectedIndex(entries: DirectoryEntry[]): string | undefined {
  const names = entries.filter((entry) =>
    entry.info?.isFile && classifyEntry(entry).index
  ).map((entry) => entry.name);
  for (const conventional of ["README.md", "index.md"]) {
    const exact = names.find((name) => name === conventional);
    if (exact) {
      return exact;
    }
    const fallback = names.filter((name) =>
      name.toLowerCase() === conventional.toLowerCase()
    ).toSorted(lexical);
    if (fallback.length) {
      return fallback[0];
    }
  }
}

export function indexCandidates(names: Iterable<string>): string[] {
  return [...names].filter((name) =>
    classifyEntry({ name, directory: false }).index
  );
}

export function markdownCandidates(
  names: Iterable<string>,
  leaf: string,
): string[] {
  const exact = `${leaf}.md`;
  return [...names].filter((name) =>
    classifyEntry({ name, directory: false }).markdown &&
    name.toLowerCase() === exact.toLowerCase()
  ).toSorted(lexical);
}
