export type FoundDeclaration = {
  name: string;
  start: number;
  end: number;
  line: number;
};

export function syntaxDeclarations(
  root: SyntaxNode,
  text: string,
  declarationTypes: readonly string[],
): FoundDeclaration[] {
  const offsets = byteOffsets(text);
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
    found.push({
      name: name.text,
      start: offsets.get(name.startIndex)!,
      end: offsets.get(name.endIndex)!,
      line: name.startPosition.row + 1,
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
  childForFieldName(name: string): SyntaxNode | null;
  namedChildren: readonly (SyntaxNode | null)[];
};

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

function byteOffsets(text: string): Map<number, number> {
  const offsets = new Map<number, number>([[0, 0]]);
  let bytes = 0;
  for (let index = 0; index < text.length;) {
    const size = text.codePointAt(index)! > 0xffff ? 2 : 1;
    bytes +=
      new TextEncoder().encode(text.slice(index, index + size)).byteLength;
    index += size;
    offsets.set(bytes, index);
  }
  return offsets;
}
