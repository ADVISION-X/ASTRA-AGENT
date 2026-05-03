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
      findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[7], file: config.INSPECTOR_ENTRY, message: `Visual Target inspector must import ${functionName}().` }));
    }
  }

  const inspectorText = inspectorSource.getFullText();
  if (!inspectorText.includes("await runNegativeProofHarness()")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[7], file: config.INSPECTOR_ENTRY, message: "Visual Target inspector must invoke and report the negative-proof harness." }));
  }

  return { findings, phase: createAttackPhase("runner-fail-power-check", findings, "Visual Target inspector retains explicit attack-function structure, so audit failures remain attributable and reviewable.", "Visual Target inspector lost its explicit attack-function structure and risks silent enforcement drift.") };
}