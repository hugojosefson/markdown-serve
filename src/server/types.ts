import type { ReloadSource } from "./reload-source.ts";
import type { FileCatalog } from "./file-catalog.ts";
import type { ErrorHandler } from "./server-options.ts";
import type { GitResolver } from "./git/resolver.ts";
import type { GitState } from "./git/state.ts";
import type { SymbolCatalog } from "./symbols/catalog.ts";
import type { FinderRunner } from "./file-search.ts";
import type { ContentSearchRunner } from "./content-search.ts";
import type { EditCoordinator } from "./edit-response.ts";
import type { FileAccess } from "./file-access.ts";

export type ServerConfig = {
  rootPath: string;
  rootLabel: string;
  redirectStatus: 301 | 302;
  onError?: ErrorHandler;
  reloadSource?: ReloadSource;
  catalog: FileCatalog;
  access?: FileAccess;
  git?: GitState;
  gitResolver?: GitResolver;
  symbols?: SymbolCatalog;
  finders?: ("fd" | "fdfind")[];
  finderRunner?: FinderRunner;
  contentSearchRunner?: ContentSearchRunner;
  edit?: boolean;
  editCoordinator?: EditCoordinator;
};
