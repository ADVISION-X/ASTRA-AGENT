import type { Project } from "ts-morph";

import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";

const getInspectionPhaseSource = (project: Project) => {
  const inspectorSource = getSourceFileOrThrow(project, config.INSPECTOR_ENTRY);
  const suiteImport = inspectorSource.getImportDeclarations().find(
    (declaration) => declaration.getModuleSpecifierValue() === "./inspection-phase-suite.js",
  );

  if (!suiteImport) {
    return { inspectorSource, phaseSource: inspectorSource };
  }

  const phaseSource = suiteImport.getModuleSpecifierSourceFile();
  if (!phaseSource) {
    return { inspectorSource, phaseSource: undefined };
  }

  return { inspectorSource, phaseSource };
};

export async function runRunnerFailPowerCheck(project: Project): Promise<AttackOutcome> {
  const findings = [];
  const { inspectorSource, phaseSource } = getInspectionPhaseSource(project);

  if (!phaseSource) {
    findings.push(createViolation({
      lawId: config.ACTIVE_LAW_IDS[7],
      file: config.INSPECTOR_ENTRY,
      severity: "fatal",
      message: "Visual Target inspector must resolve its owner-local inspection phase suite.",
    }));
    return {
      findings,
      phase: createAttackPhase("runner-fail-power-check", findings, "Visual Target inspector retains explicit attack-function structure, so audit failures remain attributable and reviewable.", "Visual Target inspector lost its explicit attack-function structure and risks silent enforcement drift."),
    };
  }

  const importedNames = new Set(phaseSource.getImportDeclarations().flatMap((declaration) => declaration.getNamedImports().map((specifier) => specifier.getName())));
  const phaseEntryPath = phaseSource === inspectorSource ? config.INSPECTOR_ENTRY : config.INSPECTION_PHASE_SUITE_PATH;

  for (const functionName of config.REQUIRED_INSPECTOR_FUNCTIONS) {
    if (!importedNames.has(functionName)) {
      findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[7], file: phaseEntryPath, message: `Visual Target enforcement phase suite must import ${functionName}().` }));
    }
  }

  return { findings, phase: createAttackPhase("runner-fail-power-check", findings, "Visual Target inspector retains explicit attack-function structure, so audit failures remain attributable and reviewable.", "Visual Target inspector lost its explicit attack-function structure and risks silent enforcement drift.") };
}