import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { getSourceFile, makeProject, missingRequiredFiles } from "./audit-project.js";
import { PATHS } from "./config.js";

const REQUIRED_SCHEMA_DECLARATIONS = ["MouseClickAbilityInputSchema", "MouseClickAbilityResultSchema", "MouseClickRuntimeProofSchema", "MouseClickSuccessOutputSchema"] as const;
const REQUIRED_INPUT_SNIPPETS = [
  "missionId: z.string().min(1),",
  "runId: z.string().min(1),",
  "stepId: z.string().min(1),",
  "mapPackageVersion: z.string().min(1),",
  "selectedMapVersion: z.string().min(1),",
  "activationSnapshotRef: z.string().min(1),",
  "capabilityCallId: z.string().min(1),",
  "nerveBusEnvelopeId: z.string().min(1),",
  "inputRef: z.string().min(1),",
  "sourceRef: z.string().min(1),",
  "geometryGuardRuntimeProofRef: z.string().min(1),",
  "idempotencyKey: z.string().min(1),",
  "timeoutMs: positiveInt,",
] as const;
const REQUIRED_INPUT_BLOCK_SNIPPETS = [
  "activationSnapshotRef: z.string().min(1),\n  capabilityCallId: z.string().min(1),\n  nerveBusEnvelopeId: z.string().min(1),\n  requestedBy: z.string().min(1),",
  "inputRef: z.string().min(1),\n  sourceRef: z.string().min(1),\n  sourceCoordinateProofRef: z.string().min(1),",
] as const;
const RESULT_BUILDER_HANDOFF_BLOCK = "idempotencyDecision: input.idempotencyDecision,\n    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,\n    dataQualityFlags: input.dataQualityFlags,\n    runtimeProof,";

function collectMissingRequiredFileFindings(filePaths: string[]): Finding[] {
  return filePaths.map((filePath) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2", file: filePath, line: 1, severity: "fatal", message: "Mouse Click required production file is missing." }));
}

function collectContractFindings(contractSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !contractSource || !hasInterfaceMethod(contractSource, "MouseClickAbilityGroup", "execute")
    ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2", file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Mouse Click must expose a stable public execute contract." })]
    : [];
}

function collectAbilityGroupFindings(abilityGroupSource: ReturnType<typeof getSourceFile>): Finding[] {
  const findings: Finding[] = [];
  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseMouseClickAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["MouseClickAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2", file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Mouse Click ability-group must parse input and parse governed output." }));
  }
  if (!abilityGroupSource) {
    return findings;
  }
  for (const forbidden of ["createSystemMouseClickClock", "createMouseClickIdempotencyRegistry"]) {
    if (hasCallExpression(abilityGroupSource, forbidden)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2", file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: `Mouse Click ability-group must not construct ${forbidden}.` }));
    }
  }
  return findings;
}

function collectSchemaDeclarationFindings(schemaSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!schemaSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Click schema file is missing." })];
  }

  return REQUIRED_SCHEMA_DECLARATIONS
    .filter((declarationName) => !schemaSource.getVariableDeclaration(declarationName))
    .map((declarationName) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Mouse Click schema must declare ${declarationName}.` }));
}

function collectSchemaSnippetFindings(schemaText: string): Finding[] {
  return [
    ...REQUIRED_INPUT_SNIPPETS
      .filter((snippet) => !schemaText.includes(snippet))
      .map((snippet) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Mouse Click schema is missing required chain snippet: ${snippet}` })),
    ...REQUIRED_INPUT_BLOCK_SNIPPETS
      .filter((snippet) => !schemaText.includes(snippet))
      .map((snippet) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Mouse Click input schema block drifted: ${snippet}` })),
  ];
}

function collectSchemaGuardFindings(schemaSource: ReturnType<typeof getSourceFile>, schemaText: string): Finding[] {
  const findings: Finding[] = [];
  if (!schemaText.includes("success proof requires post-action verification handoff")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Click schema must block success without post-action verification handoff." }));
  }
  if (!schemaText.includes("retryCount must stay 0") || !schemaText.includes("maxRetry must stay 0")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Click schema must hard-block retryCount/maxRetry drift." }));
  }
  if (!schemaSource?.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "failed and review_required require output=null")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Click result schema must force output=null for non-success states." }));
  }
  return findings;
}

function collectSchemaFindings(schemaSource: ReturnType<typeof getSourceFile>): Finding[] {
  const schemaText = schemaSource?.getFullText() ?? "";
  if (!schemaSource) {
    return collectSchemaDeclarationFindings(schemaSource);
  }
  return [
    ...collectSchemaDeclarationFindings(schemaSource),
    ...collectSchemaSnippetFindings(schemaText),
    ...collectSchemaGuardFindings(schemaSource, schemaText),
  ];
}

function collectRegistryFindings(registrySource: ReturnType<typeof getSourceFile>): Finding[] {
  return !registrySource || !registrySource.getVariableDeclaration("CHILDREN")
    ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2", file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Mouse Click registry must declare canonical children." })]
    : [];
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Click executor file is missing." })];
  }
  const project = makeProject();
  const routeSources = [
    executorSource,
    getSourceFile(project, PATHS.PREFLIGHT_STAGES),
    getSourceFile(project, PATHS.PRIMITIVE_STAGE),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);
  return ["validateGeometryProof", "validateClickPolicy", "validateMouseClickBoundary", "validatePreClickSafety", "runPrimitiveClick", "buildMouseClickResult"]
    .filter((calleeName) => !routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName)))
    .map((calleeName) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Mouse Click executor must call ${calleeName}.` }));
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  const resultBuilderText = resultBuilderSource?.getFullText() ?? "";
  const findings: Finding[] = [];
  if (!resultBuilderSource || !hasCallExpressionPath(resultBuilderSource, ["MouseClickAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder must parse the governed result shape before returning success, failure, or review_required." }));
  }
  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildMouseClickRuntimeProof")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder must preserve the governed runtime proof output." }));
  }
  if (!resultBuilderText.includes("diagnosticPayloadRef")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder must preserve diagnosticPayloadRef for non-success outcomes." }));
  }
  if (!resultBuilderText.includes(RESULT_BUILDER_HANDOFF_BLOCK)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder must preserve the top-level postActionVerificationHandoffRef handoff block." }));
  }
  return findings;
}

function collectProofBuilderFindings(proofBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  const proofBuilderText = proofBuilderSource?.getFullText() ?? "";
  const findings: Finding[] = [];
  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["MouseClickRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2", file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Mouse Click proof builder must parse runtime proof output." }));
  }
  if (!proofBuilderText.includes("runId: input.runId") || !proofBuilderText.includes("missionId: input.missionId")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2", file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Mouse Click proof builder must read missionId/runId from input chain." }));
  }
  if (proofBuilderText.includes('buildStableMouseClickRef("mouse-click-run"')) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2", file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Mouse Click proof builder must not fabricate runId from attemptRef/childCapabilityId." }));
  }
  return findings;
}

function collectBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>, proofBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return [
    ...collectResultBuilderFindings(resultBuilderSource),
    ...collectProofBuilderFindings(proofBuilderSource),
  ];
}

function collectChildImplementationFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [PATHS.BROWSER_CHILD_IMPL, PATHS.DESKTOP_CHILD_IMPL].flatMap((filePath) => {
    const childSource = getSourceFile(project, filePath);
    return !childSource || !hasCallExpression(childSource, "executeMouseClick")
      ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2", file: filePath, line: 1, severity: "fatal", message: "Mouse Click child implementation must delegate through executeMouseClick." })]
      : [];
  });
}

export async function runRequiredShapeAttack(project: ReturnType<typeof makeProject> = makeProject()): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = collectMissingRequiredFileFindings(await missingRequiredFiles());

  const abilityGroupSource = getSourceFile(project, PATHS.ABILITY_GROUP);
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  findings.push(...collectContractFindings(contractSource));
  findings.push(...collectAbilityGroupFindings(abilityGroupSource));
  findings.push(...collectSchemaFindings(schemaSource));
  findings.push(...collectRegistryFindings(registrySource));
  findings.push(...collectExecutorFindings(executorSource));
  findings.push(...collectBuilderFindings(resultBuilderSource, proofBuilderSource));
  findings.push(...collectChildImplementationFindings(project));

  const requiredFilesPresent = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      requiredFilesPresent ? "PASS" : "CODE VIOLATION",
      requiredFilesPresent,
      requiredFilesPresent
        ? "Mouse Click required package, runtime chain, and governed schema/result surfaces exist."
        : "Mouse Click required package or governed execution chain is incomplete.",
    ),
  };
}
