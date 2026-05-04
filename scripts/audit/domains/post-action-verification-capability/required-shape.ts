import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { isThinAbilityGroup } from "./escape-rules.js";
import { CHILDREN, LAW_IDS, PATHS } from "./config.js";
import { getSource, missingCanonicalFiles } from "./project-access.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const file of await missingCanonicalFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file, line: 1, severity: "fatal", message: "Required post-action-verification canonical file is missing." }));
  }
}

function collectAbilityAndContractFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const abilityGroupSource = getSource(project, PATHS.ABILITY_GROUP);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Post Action Verification ability-group must stay a thin entrypoint." }));
  }
  const contractSource = getSource(project, PATHS.CONTRACT);
  return contractSource.getInterface("PostActionVerificationChildCapability") || contractSource.getTypeAlias("PostActionVerificationAbilityContext")
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Post Action Verification contract must not expose child execute interface or runtime context." }))
    : findings;
}

function collectSchemaFindings(project: Project): Finding[] {
  const schemaSource = getSource(project, PATHS.SCHEMA);
  const schemaText = schemaSource.getFullText();
  const childIds = getZodEnumValues(getSource(project, PATHS.SCHEMA), "PostActionVerificationChildCapabilityIdSchema");
  const findings = childIds.sort().join(",") !== [...CHILDREN].sort().join(",")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Schema child ids must match the frozen child registry." })]
    : [];
  for (const snippet of ["missionId: requiredString", "runId: requiredString", "stepId: requiredString", "activationSnapshotRef: requiredString", "capabilityCallId: requiredString", "nerveBusEnvelopeId: requiredString", "idempotencyKey: requiredString"]) {
    if (!schemaText.includes(snippet)) {
      findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Post Action Verification input schema must keep the full mission/map/step chain fields machine-required." }));
      break;
    }
  }
  return findings;
}

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSource(project, PATHS.EXECUTOR);
  for (const callee of ["runPostActionVerificationGateSequence", "completePostActionVerification"] as const) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Post Action Verification executor must route through ${callee}.` }));
    }
  }

  const routeSources = {
    validatePostActionVerificationInput: PATHS.GATE_STEPS,
    validatePostActionPayloadBudget: PATHS.GATE_STEPS,
    validateActionProof: PATHS.GATE_STEPS,
    validateEvidenceSources: PATHS.GATE_STEPS,
    validateObservationProofBinding: PATHS.GATE_STEPS,
    validateBeforeAfterConsistency: PATHS.GATE_STEPS,
    validateVerificationPolicy: PATHS.GATE_STEPS,
    validatePostActionOutputBoundary: PATHS.SUCCESS_RESULT,
    finalizeVerificationDecision: PATHS.SUCCESS_RESULT,
    buildPostActionRuntimeProof: PATHS.SUCCESS_RESULT,
    buildPostActionVerificationResult: PATHS.SUCCESS_RESULT,
  } as const;

  for (const [callee, file] of Object.entries(routeSources)) {
    if (!hasCallExpression(getSource(project, file), callee)) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file, line: 1, severity: "fatal", message: `Post Action Verification execution chain must route through ${callee}.` }));
    }
  }
  return findings;
}

const hasRequiredProofBuilderChainFields = (proofBuilderText: string): boolean => {
  return [
    "missionId: request?.missionId ?? null",
    "runId: request?.runId ?? null",
    "activationSnapshotRef: request?.activationSnapshotRef ?? null",
    "capabilityCallId: request?.capabilityCallId ?? null",
    "nerveBusEnvelopeId: request?.nerveBusEnvelopeId ?? null",
  ].every((snippet) => proofBuilderText.includes(snippet));
};

const hasFabricatedProofBuilderFields = (proofBuilderText: string): boolean => {
  return proofBuilderText.includes("runId: `post-action-verification-run:${input.proofFingerprint}`")
    || proofBuilderText.includes("missionId: request?.sessionId ?? null");
};

function collectProofBuilderFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const proofBuilderSource = getSource(project, PATHS.PROOF_BUILDER);
  const proofBuilderText = proofBuilderSource.getFullText();
  if (!hasCallExpressionPath(proofBuilderSource, ["PostActionRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Proof builder must parse PostActionRuntimeProofSchema." }));
  }
  if (!hasRequiredProofBuilderChainFields(proofBuilderText) || hasFabricatedProofBuilderFields(proofBuilderText)) {
    findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Proof builder must preserve real mission/run chain fields and must not fabricate runId or missionId." }));
  }

  return findings;
}

function collectResultBuilderFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const resultBuilderSource = getSource(project, PATHS.RESULT_BUILDER);
  if (!hasCallExpressionPath(resultBuilderSource, ["PostActionVerificationAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Result builder must parse PostActionVerificationAbilityResultSchema." }));
  }
  const resultBuilderText = resultBuilderSource.getFullText();
  if (!resultBuilderText.includes("missionId: input.request?.missionId ?? null")
    || !resultBuilderText.includes("runId: input.request?.runId ?? null")
    || !resultBuilderText.includes("activationSnapshotRef: input.request?.activationSnapshotRef ?? null")
    || !resultBuilderText.includes("capabilityCallId: input.request?.capabilityCallId ?? null")
    || !resultBuilderText.includes("nerveBusEnvelopeId: input.request?.nerveBusEnvelopeId ?? null")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Result builder must preserve mission/run/step/map chain parity from the governed request." }));
  }

  return findings;
}

function collectDispatchFailureFindings(project: Project): Finding[] {
  return hasCallExpressionPath(getSource(project, PATHS.DISPATCH_FAILURE), ["PostActionVerificationAbilityInputSchema", "safeParse"])
    ? []
    : [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.DISPATCH_FAILURE, line: 1, severity: "fatal", message: "Dispatch failure must terminate through the governed invalid-input envelope path." })];
}

function collectBuilderFindings(project: Project): Finding[] {
  return [
    ...collectProofBuilderFindings(project),
    ...collectResultBuilderFindings(project),
    ...collectDispatchFailureFindings(project),
  ];
}

function collectInspectorFindings(project: Project): Finding[] {
  const inspectorSource = getSource(project, "scripts/audit/domains/post-action-verification-capability/inspector.ts");
  const inspectorText = inspectorSource.getFullText();
  return inspectorText.includes("import { runNegativeProofHarness }")
    && inspectorText.includes("SKIP_NEGATIVE_PROOF_ENV")
    && inspectorText.includes("await runNegativeProofHarness()")
    ? []
    : [createFinding({ lawId: LAW_IDS.PACKAGE, file: "scripts/audit/domains/post-action-verification-capability/inspector.ts", line: 1, severity: "fatal", message: "Post Action Verification inspector must invoke the negative-proof harness through a nested-skip guard." })];
}

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectAbilityAndContractFindings(project));
  findings.push(...collectSchemaFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));
  findings.push(...collectInspectorFindings(project));

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("required-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification canonical package shape is present." : "Post Action Verification canonical package shape is incomplete."),
  };
}