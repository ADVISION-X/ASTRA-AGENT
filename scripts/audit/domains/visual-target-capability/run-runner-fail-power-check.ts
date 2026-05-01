import type { Project } from "ts-morph";

import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";

export async function runRunnerFailPowerCheck(project: Project): Promise<AttackOutcome> {
  const findings = [];
  const inspectorSource = getSourceFileOrThrow(project, config.INSPECTOR_ENTRY);
  const importedNames = new Set(inspectorSource.getImportDeclarations().flatMap((declaration) => declaration.getNamedImports().map((specifier) => specifier.getName())));

  for (const functionName of config.REQUIRED_INSPECTOR_FUNCTIONS) {
    if (!importedNames.has(functionName)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: config.INSPECTOR_ENTRY, message: `Visual Target inspector must import ${functionName}().` }));
    }
  }

  return { findings, phase: createAttackPhase("runner-fail-power-check", findings, "Visual Target inspector retains explicit attack-function structure, so audit failures remain attributable and reviewable.", "Visual Target inspector lost its explicit attack-function structure and risks silent enforcement drift.") };
}