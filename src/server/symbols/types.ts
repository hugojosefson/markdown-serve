export type SymbolOccurrence = {
  name: string;
  start: number;
  end: number;
  line: number;
  commentLines?: number;
  href: string;
  id?: string;
  kind?: "heading";
  declaration: boolean;
};

export type SymbolDeclarationLink = {
  href: string;
  name: string;
  id?: string;
  kind?: "heading";
};

export type SymbolAnalysis = {
  occurrences: SymbolOccurrence[];
  declarationLines: ReadonlySet<number>;
  declarationCommentLines: ReadonlyMap<number, number>;
  declarationLinks: ReadonlyMap<number, SymbolDeclarationLink>;
};
