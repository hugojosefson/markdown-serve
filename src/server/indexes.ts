import { directoryEntries } from "./fs.ts";

export async function indexName(path: string): Promise<string | undefined> {
  const names = (await directoryEntries(path))
    .filter((entry) =>
      !entry.directory && /^(readme|index)\.md$/i.test(entry.name)
    )
    .map((entry) => entry.name);
  for (const conventional of ["README.md", "index.md"]) {
    const exact = names.find((name) => name === conventional);
    if (exact) {
      return exact;
    }
    const fallback = names.filter((name) =>
      name.toLowerCase() === conventional.toLowerCase()
    ).sort();
    if (fallback.length) {
      return fallback[0];
    }
  }
  return undefined;
}
