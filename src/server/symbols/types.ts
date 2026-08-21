export type SymbolOccurrence = {
  name: string;
  start: number;
  end: number;
  line: number;
  commentLines?: number;
  href: string;
  id?: string;
  declaration: boolean;
};

export type SymbolDeclarationLink = { href: string; name: string };

export type SymbolAnalysis = {
  occurrences: SymbolOccurrence[];
  declarationLines: ReadonlySet<number>;
  declarationCommentLines: ReadonlyMap<number, number>;
  declarationLinks: ReadonlyMap<number, SymbolDeclarationLink>;
};
