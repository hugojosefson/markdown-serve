export type GitStatusKind =
  | "conflict"
  | "renamed"
  | "deleted"
  | "modified"
  | "added"
  | "untracked"
  | "ignored";

export type GitFileStatus = {
  path: string;
  index: string;
  worktree: string;
  originalPath?: string;
  directory: boolean;
  kind: GitStatusKind;
  tooltip: string;
};

export type GitDirectoryStatus = {
  path: string;
  status: GitFileStatus;
  kind: GitStatusKind;
  tooltip: string;
};

export type GitStatus = {
  branch?: string;
  detached: boolean;
  ahead: number;
  behind: number;
  files: readonly GitFileStatus[];
  directories: ReadonlyMap<string, GitDirectoryStatus>;
  byPath: ReadonlyMap<string, GitFileStatus>;
};

export function gitStatusAt(
  status: GitStatus | undefined,
  path: string,
  directory = false,
): GitFileStatus | GitDirectoryStatus | undefined {
  if (!status) return undefined;
  return directory
    ? status.byPath.get(path) ?? status.directories.get(path)
    : status.byPath.get(path);
}

export function gitDisplay(
  status: GitFileStatus | GitDirectoryStatus | undefined,
): string {
  if (!status) return "";
  const file = "status" in status ? status.status : status;
  return file.index === "?" && file.worktree === "?"
    ? "??"
    : `${file.index}${file.worktree}`.trim() || status.kind[0].toUpperCase();
}

export function gitDirtyCount(status: GitStatus): number {
  return status.files.filter((file) => file.kind !== "ignored").length;
}

export function parseGitStatus(
  output: string,
  servedRootPrefix = "",
): GitStatus {
  const records = output.split("\0");
  const branch = parseBranch(records[0] ?? "");
  const files: GitFileStatus[] = [];
  for (let index = 1; index < records.length; index++) {
    const record = records[index];
    if (!record) {
      continue;
    }
    const xy = record.slice(0, 2);
    const rename = xy[0] === "R" || xy[0] === "C";
    const rawOriginalPath = rename ? records[++index] : undefined;
    const rawPath = record.slice(3);
    const directory = rawPath.endsWith("/");
    const path = stripServedRootPrefix(rawPath, servedRootPrefix);
    const originalPath = rawOriginalPath === undefined
      ? undefined
      : stripServedRootPrefix(rawOriginalPath, servedRootPrefix);
    if (path === undefined) {
      continue;
    }
    const kind = gitStatusKind(xy);
    files.push({
      path: normalizePath(path),
      index: xy[0],
      worktree: xy[1],
      originalPath,
      directory,
      kind,
      tooltip: gitTooltip(kind, originalPath),
    });
  }
  return {
    ...branch,
    files,
    directories: aggregateGitDirectories(files),
    byPath: new Map(files.map((file) => [file.path, file])),
  };
}

export function stripServedRootPrefix(
  path: string,
  prefix: string,
): string | undefined {
  const normalized = normalizePath(prefix);
  if (!normalized) {
    return path;
  }
  if (normalizePath(path) === normalized) {
    return "";
  }
  return path.startsWith(`${normalized}/`)
    ? path.slice(normalized.length + 1)
    : undefined;
}

export function aggregateGitDirectories(
  files: readonly GitFileStatus[],
): ReadonlyMap<string, GitDirectoryStatus> {
  const directories = new Map<string, GitDirectoryStatus>();
  for (const file of files) {
    const segments = file.path.split("/");
    if (!file.directory) {
      segments.pop();
    }
    while (segments.length > 0) {
      const path = segments.join("/");
      const current = directories.get(path)?.status;
      const status = !current || statusWeight(file) > statusWeight(current)
        ? file
        : current;
      directories.set(path, {
        path,
        status,
        kind: status.kind,
        tooltip: status.tooltip,
      });
      segments.pop();
    }
  }
  return directories;
}

function parseBranch(
  header: string,
): Pick<GitStatus, "branch" | "detached" | "ahead" | "behind"> {
  const value = header.startsWith("## ") ? header.slice(3) : "";
  const name = value.replace(/\.\.\..*$/, "").replace(/ \[.*$/, "");
  return {
    branch: name || undefined,
    detached: /^HEAD \(/.test(name),
    ahead: Number(value.match(/\bahead (\d+)/)?.[1] ?? 0),
    behind: Number(value.match(/\bbehind (\d+)/)?.[1] ?? 0),
  };
}

function normalizePath(path: string): string {
  if (path === ".") {
    return "";
  }
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function gitStatusKind(xy: string): GitStatusKind {
  if (xy === "!!") return "ignored";
  if (xy === "??") return "untracked";
  if (xy.includes("U") || xy === "AA" || xy === "DD") return "conflict";
  if (xy.includes("R") || xy.includes("C")) return "renamed";
  if (xy.includes("D")) return "deleted";
  if (xy.includes("M") || xy.includes("T")) return "modified";
  return "added";
}

function statusWeight(status: GitFileStatus): number {
  return {
    ignored: 0,
    untracked: 1,
    added: 2,
    modified: 3,
    deleted: 4,
    renamed: 5,
    conflict: 6,
  }[status.kind];
}

function gitTooltip(kind: GitStatusKind, originalPath?: string): string {
  const label = kind[0].toUpperCase() + kind.slice(1);
  return `${label}${originalPath ? ` from ${originalPath}` : ""}`;
}
