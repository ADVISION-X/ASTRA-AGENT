import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { EnforcementStrength } from "./coverage-types.js";

const strengthRank: Record<EnforcementStrength, number> = {
  LEVEL_5_AST_SYMBOL_IMPORT_GRAPH_NEGATIVE_PROOF: 5,
  LEVEL_4_STRUCTURAL_NEGATIVE_PROOF: 4,
  LEVEL_3_SCHEMA_JSON_NEGATIVE_PROOF: 3,
  LEVEL_2_EXACT_TEXT_GENERATED_NEGATIVE_PROOF: 2,
  LEVEL_1_TEXT_INCLUDES_PATH_EXISTS: 1,
  LEVEL_0_MANUAL_ONLY_OR_MISSING: 0,
};

export const getStrengthRank = (strength: EnforcementStrength): number => strengthRank[strength];

export const maxStrength = (strengths: EnforcementStrength[]): EnforcementStrength =>
  strengths.sort((left, right) => getStrengthRank(right) - getStrengthRank(left))[0] ?? "LEVEL_0_MANUAL_ONLY_OR_MISSING";

export const classifyInspectorStrength = async (entry: string, hasNegativeProof: boolean): Promise<EnforcementStrength> => {
  const absoluteEntry = pathFromRepoRoot(entry);
  if (!(await fileExists(absoluteEntry))) {
    return "LEVEL_0_MANUAL_ONLY_OR_MISSING";
  }

  const source = await readTextFile(absoluteEntry);
  const hasAst = /ts-morph|SourceFile|SyntaxKind|getDescendants|getImportDeclarations|createAuditProject/.test(source);
  const hasImportGraph = /import graph|ImportDeclaration|getImportDeclarations|forbidden import|boundary import/i.test(source);
  const hasSchemaTraversal = /zod|schema|JSON|parse|safeParse|readJsonFile|traversal/i.test(source);
  const hasGeneratedArtifact = /generated|artifact|exact|includes|path exists|fileExists/i.test(source);

  if (hasNegativeProof && hasAst && hasImportGraph) {
    return "LEVEL_5_AST_SYMBOL_IMPORT_GRAPH_NEGATIVE_PROOF";
  }
  if (hasNegativeProof && (hasAst || hasImportGraph)) {
    return "LEVEL_4_STRUCTURAL_NEGATIVE_PROOF";
  }
  if (hasNegativeProof && hasSchemaTraversal) {
    return "LEVEL_3_SCHEMA_JSON_NEGATIVE_PROOF";
  }
  if (hasNegativeProof && hasGeneratedArtifact) {
    return "LEVEL_2_EXACT_TEXT_GENERATED_NEGATIVE_PROOF";
  }
  if (hasGeneratedArtifact || /includes|fileExists|pathFromRepoRoot/.test(source)) {
    return "LEVEL_1_TEXT_INCLUDES_PATH_EXISTS";
  }

  return "LEVEL_0_MANUAL_ONLY_OR_MISSING";
};
