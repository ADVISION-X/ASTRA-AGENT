import path from "node:path";

import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { EnforcementStrength } from "./coverage-types.js";

const strengthRank: Record<EnforcementStrength, number> = {
  LEVEL_5_AST_SYMBOL_IMPORT_GRAPH: 5,
  LEVEL_4_STRUCTURAL: 4,
  LEVEL_3_SCHEMA_JSON: 3,
  LEVEL_2_EXACT_TEXT_GENERATED: 2,
  LEVEL_1_TEXT_INCLUDES_PATH_EXISTS: 1,
  LEVEL_0_MANUAL_ONLY_OR_MISSING: 0,
};

export const getStrengthRank = (strength: EnforcementStrength): number => strengthRank[strength];

export const maxStrength = (strengths: EnforcementStrength[]): EnforcementStrength =>
  strengths.sort((left, right) => getStrengthRank(right) - getStrengthRank(left))[0] ?? "LEVEL_0_MANUAL_ONLY_OR_MISSING";

const hasAnyPattern = (source: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(source));

const classifyStructuralStrength = (source: string, hasStructuralEvidence: boolean): EnforcementStrength | null => {
  const hasAst = hasAnyPattern(source, [/ts-morph/, /SourceFile/, /SyntaxKind/, /getDescendants/, /createAuditProject/]);
  const hasImportGraph = hasAnyPattern(source, [/import graph/i, /getImportDeclarations/, /forbidden import/i, /boundary import/i]);
  if (hasStructuralEvidence && hasAst && hasImportGraph) {
    return "LEVEL_5_AST_SYMBOL_IMPORT_GRAPH";
  }
  if (hasStructuralEvidence && (hasAst || hasImportGraph)) {
    return "LEVEL_4_STRUCTURAL";
  }
  return null;
};

const classifyNonStructuralStrength = (source: string, hasStructuralEvidence: boolean): EnforcementStrength => {
  const hasSchemaTraversal = /zod|schema|JSON|parse|safeParse|readJsonFile|traversal/i.test(source);
  const hasGeneratedArtifact = /generated|artifact|exact|includes|path exists|fileExists/i.test(source);
  if (hasStructuralEvidence && hasSchemaTraversal) {
    return "LEVEL_3_SCHEMA_JSON";
  }
  if (hasStructuralEvidence && hasGeneratedArtifact) {
    return "LEVEL_2_EXACT_TEXT_GENERATED";
  }
  if (hasGeneratedArtifact || /includes|fileExists|pathFromRepoRoot/.test(source)) {
    return "LEVEL_1_TEXT_INCLUDES_PATH_EXISTS";
  }
  return "LEVEL_0_MANUAL_ONLY_OR_MISSING";
};

const readInspectorDomainSource = async (entry: string): Promise<string> => {
  const absoluteEntry = pathFromRepoRoot(entry);
  const domainDir = path.dirname(absoluteEntry);
  const sourceFiles = await listFilesRecursive(domainDir, { extensions: [".ts"] });
  const sources = await Promise.all(sourceFiles.map((sourceFile) => readTextFile(sourceFile)));
  return sources.join("\n");
};

export const classifyInspectorStrength = async (entry: string, hasStructuralEvidence: boolean): Promise<EnforcementStrength> => {
  const absoluteEntry = pathFromRepoRoot(entry);
  if (!(await fileExists(absoluteEntry))) {
    return "LEVEL_0_MANUAL_ONLY_OR_MISSING";
  }

  const source = await readInspectorDomainSource(entry);
  const structuralStrength = classifyStructuralStrength(source, hasStructuralEvidence);
  if (structuralStrength) {
    return structuralStrength;
  }
  return classifyNonStructuralStrength(source, hasStructuralEvidence);
};
