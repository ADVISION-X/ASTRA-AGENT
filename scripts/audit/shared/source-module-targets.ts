import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ExportDeclaration,
  type ImportDeclaration,
  type SourceFile,
} from "ts-morph";

import { toRepoPath } from "./paths.js";

export type SourceModuleTarget = {
  edgeKind: "import" | "re-export";
  exposedNames: string[];
  namedBindings: string[];
  namespaceImport: boolean;
  targetPath: string;
};

export type SourceModuleBinding = {
  column: number;
  defaultImportLocalName: string | null;
  edgeKind: "dynamic-import" | "import" | "re-export" | "side-effect-import";
  exposedSymbolName: string | null;
  importedSymbolName: string | null;
  isTypeOnly: boolean;
  line: number;
  localSymbolName: string | null;
  namespaceLocalName: string | null;
  sourcePath: string;
  targetPath: string;
};

const candidateSuffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mjs"];

const resolveRelativeTargetPath = (sourceFile: SourceFile, moduleSpecifierValue: string): string | undefined => {
  if (!moduleSpecifierValue.startsWith("./") && !moduleSpecifierValue.startsWith("../")) {
    return undefined;
  }
  const candidateBasePath = resolve(dirname(sourceFile.getFilePath()), moduleSpecifierValue);
  for (const suffix of candidateSuffixes) {
    const candidatePath = `${candidateBasePath}${suffix}`;
    if (existsSync(candidatePath)) {
      return toRepoPath(candidatePath);
    }
  }
  return undefined;
};

const resolveModuleTargetPath = (
  sourceFile: SourceFile,
  targetFile: SourceFile | undefined,
  moduleSpecifierValue: string,
): string | undefined => targetFile ? toRepoPath(targetFile.getFilePath()) : resolveRelativeTargetPath(sourceFile, moduleSpecifierValue);

const resolveImportLikeTargetPath = (sourceFile: SourceFile, moduleSpecifierValue: string): string | undefined =>
  resolveModuleTargetPath(sourceFile, undefined, moduleSpecifierValue);

const buildBindingLocation = (sourceFile: SourceFile, start: number): { column: number; line: number } =>
  sourceFile.getLineAndColumnAtPos(start);

const createSourceModuleBinding = (
  sourceFile: SourceFile,
  start: number,
  input: Omit<SourceModuleBinding, "column" | "line" | "sourcePath">,
): SourceModuleBinding => {
  const location = buildBindingLocation(sourceFile, start);
  return {
    ...input,
    column: location.column,
    line: location.line,
    sourcePath: toRepoPath(sourceFile.getFilePath()),
  };
};

const buildImportTarget = (sourceFile: SourceFile, importDeclaration: ImportDeclaration): SourceModuleTarget | undefined => {
  const targetPath = resolveModuleTargetPath(
    sourceFile,
    importDeclaration.getModuleSpecifierSourceFile(),
    importDeclaration.getModuleSpecifierValue(),
  );
  if (!targetPath) {
    return undefined;
  }
  const namedBindings: string[] = [];
  if (importDeclaration.getDefaultImport()) {
    namedBindings.push("default");
  }
  for (const namedImport of importDeclaration.getNamedImports()) {
    namedBindings.push(namedImport.getNameNode().getText());
  }
  return {
    edgeKind: "import",
    exposedNames: namedBindings,
    namedBindings,
    namespaceImport: importDeclaration.getNamespaceImport() !== undefined,
    targetPath,
  };
};

const buildReExportTarget = (sourceFile: SourceFile, exportDeclaration: ExportDeclaration): SourceModuleTarget | undefined => {
  const targetPath = resolveModuleTargetPath(
    sourceFile,
    exportDeclaration.getModuleSpecifierSourceFile(),
    exportDeclaration.getModuleSpecifierValue() ?? "",
  );
  if (!targetPath) {
    return undefined;
  }
  return {
    edgeKind: "re-export",
    exposedNames: exportDeclaration.getNamedExports().map((namedExport) => namedExport.getAliasNode()?.getText() ?? namedExport.getNameNode().getText()),
    namedBindings: exportDeclaration.getNamedExports().map((namedExport) => namedExport.getNameNode().getText()),
    namespaceImport: exportDeclaration.getNamedExports().length === 0,
    targetPath,
  };
};

const collectImportBindings = (sourceFile: SourceFile, importDeclaration: ImportDeclaration): SourceModuleBinding[] => {
  const targetPath = resolveModuleTargetPath(
    sourceFile,
    importDeclaration.getModuleSpecifierSourceFile(),
    importDeclaration.getModuleSpecifierValue(),
  );
  if (!targetPath) {
    return [];
  }

  const bindings: SourceModuleBinding[] = [];
  const declarationIsTypeOnly = importDeclaration.isTypeOnly();
  const start = importDeclaration.getStart();
  const defaultImport = importDeclaration.getDefaultImport();
  if (defaultImport) {
    bindings.push(
      createSourceModuleBinding(sourceFile, start, {
        defaultImportLocalName: defaultImport.getText(),
        edgeKind: "import",
        exposedSymbolName: null,
        importedSymbolName: "default",
        isTypeOnly: declarationIsTypeOnly,
        localSymbolName: defaultImport.getText(),
        namespaceLocalName: null,
        targetPath,
      }),
    );
  }

  for (const namedImport of importDeclaration.getNamedImports()) {
    bindings.push(
      createSourceModuleBinding(sourceFile, namedImport.getStart(), {
        defaultImportLocalName: null,
        edgeKind: "import",
        exposedSymbolName: null,
        importedSymbolName: namedImport.getNameNode().getText(),
        isTypeOnly: declarationIsTypeOnly || namedImport.isTypeOnly(),
        localSymbolName: namedImport.getAliasNode()?.getText() ?? namedImport.getNameNode().getText(),
        namespaceLocalName: null,
        targetPath,
      }),
    );
  }

  const namespaceImport = importDeclaration.getNamespaceImport();
  if (namespaceImport) {
    bindings.push(
      createSourceModuleBinding(sourceFile, namespaceImport.getStart(), {
        defaultImportLocalName: null,
        edgeKind: "import",
        exposedSymbolName: null,
        importedSymbolName: null,
        isTypeOnly: declarationIsTypeOnly,
        localSymbolName: namespaceImport.getText(),
        namespaceLocalName: namespaceImport.getText(),
        targetPath,
      }),
    );
  }

  if (bindings.length === 0) {
    bindings.push(
      createSourceModuleBinding(sourceFile, start, {
        defaultImportLocalName: null,
        edgeKind: "side-effect-import",
        exposedSymbolName: null,
        importedSymbolName: null,
        isTypeOnly: false,
        localSymbolName: null,
        namespaceLocalName: null,
        targetPath,
      }),
    );
  }

  return bindings;
};

const collectReExportBindings = (sourceFile: SourceFile, exportDeclaration: ExportDeclaration): SourceModuleBinding[] => {
  const targetPath = resolveModuleTargetPath(
    sourceFile,
    exportDeclaration.getModuleSpecifierSourceFile(),
    exportDeclaration.getModuleSpecifierValue() ?? "",
  );
  if (!targetPath) {
    return [];
  }

  const namedExports = exportDeclaration.getNamedExports();
  if (namedExports.length === 0) {
    return [
      createSourceModuleBinding(sourceFile, exportDeclaration.getStart(), {
        defaultImportLocalName: null,
        edgeKind: "re-export",
        exposedSymbolName: "*",
        importedSymbolName: "*",
        isTypeOnly: exportDeclaration.isTypeOnly(),
        localSymbolName: null,
        namespaceLocalName: null,
        targetPath,
      }),
    ];
  }

  return namedExports.map((namedExport) =>
    createSourceModuleBinding(sourceFile, namedExport.getStart(), {
      defaultImportLocalName: null,
      edgeKind: "re-export",
      exposedSymbolName: namedExport.getAliasNode()?.getText() ?? namedExport.getNameNode().getText(),
      importedSymbolName: namedExport.getNameNode().getText(),
      isTypeOnly: exportDeclaration.isTypeOnly(),
      localSymbolName: null,
      namespaceLocalName: null,
      targetPath,
    }),
  );
};

const isDynamicImportCall = (callExpression: CallExpression): boolean =>
  callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword;

const collectDynamicImportBindings = (sourceFile: SourceFile): SourceModuleBinding[] => {
  const bindings: SourceModuleBinding[] = [];
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!isDynamicImportCall(callExpression)) {
      continue;
    }
    const argument = callExpression.getArguments()[0];
    if (!argument) {
      continue;
    }
    let moduleSpecifierValue: string | undefined;
    if (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) {
      moduleSpecifierValue = argument.getLiteralValue();
    }
    if (!moduleSpecifierValue) {
      continue;
    }
    const targetPath = resolveImportLikeTargetPath(sourceFile, moduleSpecifierValue);
    if (!targetPath) {
      continue;
    }
    bindings.push(
      createSourceModuleBinding(sourceFile, callExpression.getStart(), {
        defaultImportLocalName: null,
        edgeKind: "dynamic-import",
        exposedSymbolName: null,
        importedSymbolName: null,
        isTypeOnly: false,
        localSymbolName: null,
        namespaceLocalName: null,
        targetPath,
      }),
    );
  }
  return bindings;
};

export const collectResolvedModuleTargets = (sourceFile: SourceFile): SourceModuleTarget[] => {
  const targets: SourceModuleTarget[] = [];
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = buildImportTarget(sourceFile, importDeclaration);
    if (target) {
      targets.push(target);
    }
  }
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const target = buildReExportTarget(sourceFile, exportDeclaration);
    if (target) {
      targets.push(target);
    }
  }
  return targets;
};

export const collectResolvedModuleBindings = (sourceFile: SourceFile): SourceModuleBinding[] => {
  const bindings: SourceModuleBinding[] = [];
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    bindings.push(...collectImportBindings(sourceFile, importDeclaration));
  }
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    bindings.push(...collectReExportBindings(sourceFile, exportDeclaration));
  }
  bindings.push(...collectDynamicImportBindings(sourceFile));
  return bindings;
};
