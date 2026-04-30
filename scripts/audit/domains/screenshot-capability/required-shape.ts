import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues, hasCallExpression, hasCallExpressionPath, hasInterfaceMethod } from "../_shared/ast-helpers.js";
import { CHILDREN, ROOT, getRegistryChildIds, getSource, isThinAbilityGroup, missingCanonicalFiles } from "./ast-utils.js";

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingCanonicalFiles();
  for (const filePath of missingFiles) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
      file: filePath,
      line: 1,
      severity: "fatal",
      message: "Screenshot required canonical file is missing.",
    }));
  }

  const abilityGroupSource = getSource(project, `${ROOT}/ability-group.ts`);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
      file: `${ROOT}/ability-group.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot ability-group must stay a thin execute-only entrypoint.",
    }));
  }

  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  if (!hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "execute") || !hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "listChildCapabilityIds")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
      file: `${ROOT}/contract.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot public contract must expose execute and listChildCapabilityIds.",
    }));
  }

  const publicInterface = contractSource.getInterface("ScreenshotAbilityGroup");
  const publicMethods = publicInterface?.getMethods().map((method) => method.getName()) ?? [];
  if (publicMethods.length !== 2 || publicMethods.some((methodName) => !["execute", "listChildCapabilityIds"].includes(methodName))) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
      file: `${ROOT}/contract.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot ability-group contract must not expose extra public methods.",
    }));
  }

  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const schemaChildIds = getZodEnumValues(schemaSource, "ScreenshotChildCapabilityIdSchema");
  const registryChildIds = getRegistryChildIds(getSource(project, `${ROOT}/registry.ts`));
  if (schemaChildIds.sort().join(",") !== [...CHILDREN].sort().join(",") || registryChildIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/schema.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot schema and registry child ids must match the frozen child set.",
    }));
  }

  const executorSource = getSource(project, `${ROOT}/runtime/screenshot-executor.ts`);
  for (const calleeName of [
    "runScreenshotInputGate",
    "runScreenshotPayloadBudgetGate",
    "runScreenshotSourceGate",
    "runBrowserSessionGate",
    "runPageStateHandoffGate",
    "runPrivacyPolicyGate",
    "runRegionProofGate",
    "runArtifactStorageGate",
    "runScreenshotOutputBoundaryGate",
    "buildScreenshotRuntimeProof",
    "buildScreenshotResult",
  ]) {
    if (!hasCallExpression(executorSource, calleeName)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1",
        file: `${ROOT}/runtime/screenshot-executor.ts`,
        line: 1,
        severity: "fatal",
        message: `Screenshot executor must route through ${calleeName}.`,
      }));
    }
  }

  const proofBuilderSource = getSource(project, `${ROOT}/runtime/screenshot-proof-builder.ts`);
  if (!hasCallExpressionPath(proofBuilderSource, ["ScreenshotRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/runtime/screenshot-proof-builder.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot proof builder must parse the governed runtime proof schema.",
    }));
  }

  const resultBuilderSource = getSource(project, `${ROOT}/runtime/screenshot-result-builder.ts`);
  if (!hasCallExpressionPath(resultBuilderSource, ["ScreenshotExecutionOutputSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["ScreenshotResultSchema", "parse"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/runtime/screenshot-result-builder.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot result builder must parse governed execution output and public result schemas.",
    }));
  }

  const dispatchFailureSource = getSource(project, `${ROOT}/runtime/screenshot-dispatch-failure.ts`);
  if (!hasCallExpression(dispatchFailureSource, "buildScreenshotRuntimeProof") || !hasCallExpression(dispatchFailureSource, "buildScreenshotResult")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/runtime/screenshot-dispatch-failure.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot invalid-input handling must terminate through governed proof and result builders.",
    }));
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot canonical package, thin entrypoint, and governed runtime chain are present."
        : "Screenshot canonical package or governed runtime chain is incomplete.",
    ),
  };
}