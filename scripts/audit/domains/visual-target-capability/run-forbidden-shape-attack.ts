import { SyntaxKind, type Project } from "ts-morph";

import { fileExists, listFilesRecursive, pathFromRepoRoot, toRepoRelativePath } from "./inspection-core.js";
import { flattenPropertyAccess } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, toLine, toRootRelative, type AttackOutcome } from "./inspection-helpers.js";
import { getVisualTargetSourceFiles, hasWildcardExport } from "./inspection-source-helpers.js";

const collectForbiddenPathFindings = async () => {
  const findings = [];
  for (const forbiddenPath of config.FORBIDDEN_FILES) {
    if (await fileExists(pathFromRepoRoot(forbiddenPath))) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: forbiddenPath, severity: "fatal", message: `Forbidden legacy file still exists: ${forbiddenPath}` }));
    }
  }
  return findings;
};

const collectCapabilityCheckFindings = async () => {
  const findings = [];
  const rootPaths = await listFilesRecursive(pathFromRepoRoot(config.ROOT), { extensions: [".ts"] });
  for (const filePath of rootPaths) {
    const relativePath = toRepoRelativePath(filePath);
    if (relativePath.endsWith("capability-check.ts")) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, severity: "fatal", message: "Visual Target must not use capability-check.ts pseudo-acceptance files." }));
    }
  }
  return findings;
};

const collectSourceForbiddenFindings = (sourceFile: import("ts-morph").SourceFile) => {
  const findings = [];
  const relativePath = toRootRelative(sourceFile);
  if (hasWildcardExport(sourceFile)) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, severity: "fatal", message: "Visual Target must not use export * barrel exports." }));
  }
  for (const declaration of sourceFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    if (config.FORBIDDEN_IMPORT_MARKERS.some((marker) => specifier.includes(marker))) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, line: toLine(declaration), severity: "fatal", message: `Visual Target imported forbidden owner surface ${specifier}.` }));
    }
  }

  const forbiddenOwnerAccess = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).find((expression) => {
    const path = flattenPropertyAccess(expression);
    return path[0] === "screenshotAbilityGroup" || path[0] === "geometryGuardAbilityGroup" || path[0] === "mouseClickAbilityGroup" || path[0] === "mouseScrollAbilityGroup" || path[0] === "forensicsPersistenceAbilityGroup";
  });
  return forbiddenOwnerAccess
    ? [...findings, createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, line: toLine(forbiddenOwnerAccess), severity: "fatal", message: "Visual Target must not call or hold foreign owner ability groups directly." })]
    : findings;
};

export async function runForbiddenShapeAttack(project: Project): Promise<AttackOutcome> {
  const findings = [];
  findings.push(...await collectForbiddenPathFindings());
  findings.push(...await collectCapabilityCheckFindings());
  findings.push(...getVisualTargetSourceFiles(project).flatMap((sourceFile) => collectSourceForbiddenFindings(sourceFile)));

  return { findings, phase: createAttackPhase("forbidden-shape-attack", findings, "Visual Target forbidden legacy files, foreign-owner imports, capability-check shims, and barrel exports are absent.", "Visual Target still contains forbidden legacy files, foreign-owner imports, or escape-friendly export shapes.") };
}