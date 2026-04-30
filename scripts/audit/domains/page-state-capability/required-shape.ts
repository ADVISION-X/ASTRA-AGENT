import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { CHILDREN, ROOT, getSource, isThinAbilityGroup, missingCanonicalFiles } from "./ast-utils.js";
import type { Project } from "ts-morph";

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingCanonicalFiles();
  for (const file of missingFiles) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file, line: 1, severity: "fatal", message: "Required page-state canonical file is missing." }));
  }

  const abilityGroupSource = getSource(project, `${ROOT}/ability-group.ts`);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: `${ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "Page State ability-group must stay a thin entrypoint." }));
  }

  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  if (contractSource.getInterface("PageStateChildCapability")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: `${ROOT}/contract.ts`, line: 1, severity: "fatal", message: "Page State contract must not expose child execute interface." }));
  }

  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const childIds = getZodEnumValues(schemaSource, "PageStateChildCapabilityIdSchema");
  if (childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema child ids must match the frozen child registry." }));
  }
  if (!hasCallExpressionPath(schemaSource, ["PageStateAbilityInputSchema", "extend"]) || !schemaSource.getVariableDeclaration("PageStateOutputSchema")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must expose governed input/output shapes." }));
  }

  const executorSource = getSource(project, `${ROOT}/runtime/page-state-executor.ts`);
  for (const callee of [
    "gatePageStateInput",
    "gatePageStatePayloadBudget",
    "gateObservationSources",
    "gateObservationProofBinding",
    "gateSnapshotFreshness",
    "gatePlatformProfile",
    "classifyPageState",
    "decideProceed",
    "createPageStateFingerprint",
    "buildPageStateRuntimeProof",
    "buildPageStateResult",
  ]) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: `${ROOT}/runtime/page-state-executor.ts`, line: 1, severity: "fatal", message: `Page State executor must route through ${callee}.` }));
    }
  }

  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-proof-builder.ts`);
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builder.ts`);
  const dispatchFailure = getSource(project, `${ROOT}/runtime/page-state-dispatch-failure.ts`);
  if (!hasCallExpressionPath(proofBuilder, ["PageStateRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: `${ROOT}/runtime/page-state-proof-builder.ts`, line: 1, severity: "fatal", message: "Page State proof builder must parse its public proof schema." }));
  }
  if (!hasCallExpressionPath(resultBuilder, ["PageStateAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/runtime/page-state-result-builder.ts`, line: 1, severity: "fatal", message: "Page State result builder must parse its public result schema." }));
  }
  if (!hasCallExpressionPath(dispatchFailure, ["PageStateAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/runtime/page-state-dispatch-failure.ts`, line: 1, severity: "fatal", message: "Invalid input failure must terminate as a governed result envelope." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-required-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State canonical package shape is present." : "Page State canonical package shape is incomplete."),
  };
}