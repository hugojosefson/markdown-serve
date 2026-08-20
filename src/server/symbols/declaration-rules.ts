const declarations: Readonly<Record<string, readonly string[]>> = {
  bash: ["function_definition"],
  c: [
    "function_definition",
    "struct_specifier",
    "union_specifier",
    "enum_specifier",
    "type_definition",
  ],
  cpp: [
    "function_definition",
    "class_specifier",
    "struct_specifier",
    "union_specifier",
    "enum_specifier",
    "type_definition",
    "namespace_definition",
    "alias_declaration",
  ],
  csharp: [
    "class_declaration",
    "interface_declaration",
    "method_declaration",
    "enum_declaration",
    "struct_declaration",
    "constructor_declaration",
    "record_declaration",
    "namespace_declaration",
    "delegate_declaration",
  ],
  go: ["function_declaration", "method_declaration", "type_spec"],
  java: [
    "class_declaration",
    "interface_declaration",
    "method_declaration",
    "enum_declaration",
    "constructor_declaration",
    "record_declaration",
    "annotation_type_declaration",
  ],
  javascript: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "generator_function_declaration",
  ],
  jsx: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "generator_function_declaration",
  ],
  python: ["function_definition", "class_definition"],
  rust: [
    "function_item",
    "struct_item",
    "enum_item",
    "trait_item",
    "union_item",
    "mod_item",
    "type_item",
  ],
  typescript: typescriptDeclarations(),
  tsx: typescriptDeclarations(),
};

export function declarationTypes(
  language: string,
): readonly string[] | undefined {
  return declarations[language];
}

export function symbolGrammar(language: string): string | undefined {
  if (!declarations[language]) return;
  return language === "jsx" ? "javascript" : language;
}

function typescriptDeclarations(): readonly string[] {
  return [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "interface_declaration",
    "enum_declaration",
    "type_alias_declaration",
    "module",
    "internal_module",
    "abstract_class_declaration",
    "abstract_method_signature",
    "method_signature",
    "function_signature",
    "generator_function_declaration",
  ];
}
