import { lexical } from "./paths.ts";

type DirectoryEntryLike = { directory: boolean; name: string };

export function compareDirectoryGroups(
  left: DirectoryEntryLike,
  right: DirectoryEntryLike,
): number {
  return Number(right.directory) - Number(left.directory);
}

export function compareDirectoriesFirst(
  left: DirectoryEntryLike,
  right: DirectoryEntryLike,
): number {
  return compareDirectoryGroups(left, right) || lexical(left.name, right.name);
}
