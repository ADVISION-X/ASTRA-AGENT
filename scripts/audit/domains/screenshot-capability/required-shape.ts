import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues, hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";

import { CHILDREN, LAW_IDS, PATHS } from "./config.js";
import { getRegistryChildIds, getSource, missingCanonicalFiles } from "./project-access.js";
import { isThinAbilityGroup } from "./source-rules.js";

const EXECUTOR_ROUTE_SOURCES = [
  PATHS.EXECUTOR,
  PATHS.EXECUTION_FLOW,
  PATHS.EXECUTION_PHASES,
  PATHS.EXECUTION_SUCCESS,
  PATHS.EXECUTION_SUCCESS_RESULT,
] as const;

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingCanonicalFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: filePath, line: 1, severity: "fatal", message: "Screenshot required canonical file is missing." }));
  }
}

function collectAbilityGroupAndContractFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const abilityGroupSource = getSource(project, PATHS.ABILITY_GROUP);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Screenshot ability-group must stay a thin execute-only entrypoint." }));
  }
  const contractSource = getSource(project, PATHS.CONTRACT);
  if (!hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "execute") || !hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "listChildCapabilityIds")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Screenshot public contract must expose execute and listChildCapabilityIds." }));
  }
  const publicMethods = contractSource.getInterface("ScreenshotAbilityGroup")?.getMethods().map((method) => method.getName()) ?? [];
  return publicMethods.length !== 2 || publicMethods.some((methodName) => !["execute", "listChildCapabilityIds"].includes(methodName))
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Screenshot ability-group contract must not expose extra public methods." }))
    : findings;
}

function collectSchemaAndRegistryFindings(project: Project): Finding[] {
  const schemaSource = getSource(project, PATHS.SCHEMA);
  const schemaChildIds = getZodEnumValues(schemaSource, "ScreenshotChildCapabilityIdSchema");
  const registryChildIds = getRegistryChildIds(getSource(project, PATHS.REGISTRY));
  return schemaChildIds.sort().join(",") !== [...CHILDREN].sort().join(",") || registryChildIds.sort().join(",") !== [...CHILDREN].sort().join(",")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema and registry child ids must match the frozen child set." })]
    : [];
}

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const routeSources = EXECUTOR_ROUTE_SOURCES.map((path) => getSource(project, path));
  for (const calleeName of ["runScreenshotInputGate", "runScreenshotPayloadBudgetGate", "runScreenshotSourceGate", "runBrowserSessionGate", "runPageStateHandoffGate", "runPrivacyPolicyGate", "runRegionProofGate", "runArtifactStorageGate", "runScreenshotOutputBoundaryGate", "buildScreenshotRuntimeProof", "buildScreenshotResult"]) {
    if (!routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName))) {
      findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Screenshot executor must route through ${calleeName}.` }));
    }
  }
  return findings;
}

function collectBuilderFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (!hasCallExpressionPath(getSource(project, PATHS.PROOF_BUILDER), ["ScreenshotRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Screenshot proof builder must parse the governed runtime proof schema." }));
  }
  const resultBuilderSource = getSource(project, PATHS.RESULT_BUILDER);
  if (!hasCallExpressionPath(resultBuilderSource, ["ScreenshotExecutionOutputSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["ScreenshotResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Screenshot result builder must parse governed execution output and public result schemas." }));
  }
  const dispatchFailureSource = getSource(project, PATHS.DISPATCH_FAILURE);
  return !hasCallExpression(dispatchFailureSource, "buildScreenshotRuntimeProof") || !hasCallExpression(dispatchFailureSource, "buildScreenshotResult")
    ? findings.concat(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.DISPATCH_FAILURE, line: 1, severity: "fatal", message: "Screenshot invalid-input handling must terminate through governed proof and result builders." }))
    : findings;
}

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectAbilityGroupAndContractFindings(project));
  findings.push(...collectSchemaAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));

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