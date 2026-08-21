export type FoundDeclaration = {
  name: string;
  start: number;
  end: number;
  line: number;
  declarationLine: number;
};

export function syntaxDeclarations(
  root: SyntaxNode,
  declarationTypes: readonly string[],
): FoundDeclaration[] {
  const found: FoundDeclaration[] = [];
  const foundOffsets = new Set<number>();
  visit(root, (node) => {
    if (!declarationTypes.includes(node.type)) return;
    const name = declarationName(node);
    if (
      !name || !isIdentifier(name.text) || foundOffsets.has(name.startIndex)
    ) {
      return;
    }
    foundOffsets.add(name.startIndex);
    const start = declarationStart(node);
    found.push({
      name: name.text,
      // web-tree-sitter exposes JavaScript string offsets, not UTF-8 bytes.
      start: name.startIndex,
      end: name.endIndex,
      line: name.startPosition.row + 1,
      declarationLine: start.startPosition.row + 1,
    });
  });
  return found;
}

type SyntaxNode = {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number };
  endPosition: { row: number };
  parent: SyntaxNode | null;
  previousNamedSibling: SyntaxNode | null;
  childForFieldName(name: string): SyntaxNode | null;
  namedChildren: readonly (SyntaxNode | null)[];
};

function declarationStart(node: SyntaxNode): SyntaxNode {
  let start = node;
  while (
    start.parent &&
    ["decorated_definition", "export_statement"].includes(start.parent.type)
  ) {
    start = start.parent;
  }
  while (
    start.previousNamedSibling?.type === "attribute_item" &&
    start.previousNamedSibling.endPosition.row + 1 === start.startPosition.row
  ) {
    start = start.previousNamedSibling;
  }
  return start;
}

function declarationName(node: SyntaxNode): SyntaxNode | null {
  const direct = node.childForFieldName("name");
  if (direct && isNameNode(direct)) return direct;
  // C and C++ place function and typedef names under nested declarators.
  const declarator = node.childForFieldName("declarator");
  return declarator ? declaratorName(declarator) : null;
}

function declaratorName(node: SyntaxNode): SyntaxNode | null {
  if (isNameNode(node)) return node;
  const nested = node.childForFieldName("declarator") ??
    node.childForFieldName("name");
  if (nested) {
    const name = declaratorName(nested);
    if (name) return name;
  }
  for (const child of node.namedChildren) {
    if (!child) continue;
    const name = declaratorName(child);
    if (name) return name;
  }
  return null;
}

function isNameNode(node: SyntaxNode): boolean {
  return node.type === "identifier" || node.type === "type_identifier" ||
    node.type === "field_identifier" || node.type === "namespace_identifier" ||
    node.type === "property_identifier" || node.type === "word";
}

function isIdentifier(value: string): boolean {
  return /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u.test(value);
}

function visit(node: SyntaxNode, action: (node: SyntaxNode) => void): void {
  action(node);
  for (const child of node.namedChildren) if (child) visit(child, action);
}
