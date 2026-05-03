import type { Project, SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";
import { hasCallExpression } from "./open-ast-queries.js";

const {
  DISPATCH_FAILURE_BUILDERS_PATH,
  IDEMPOTENCY_PATH,
  LAW_PAGE_STATE_HANDOFF,
  LAW_RESULT_PROOF,
  LAW_RUNTIME_GOVERNANCE,
  PROOF_BUILDER_PATH,
  RESULT_BUILDER_PATH,
} = openInspectionConstants;
const { getOpenSourceOrThrow, getReturnedObjectPropertyNames } = openInspectionUtils;

type ReturnedObjectSpec = {
  functionName: string;
  requiredFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
};

const RESULT_ENVELOPE_SPECS: readonly ReturnedObjectSpec[] = [
  {
    functionName: "buildOpenResultEnvelopeCoreFields",
    requiredFields: [
      "missionId",
      "runId",
      "sessionId",
      "stepId",
      "mapPackageId",
      "mapPackageVersion",
      "selectedMapId",
      "selectedMapVersion",
      "activationSnapshotRef",
      "capabilityCallId",
      "nerveBusEnvelopeId",
      "diagnosticPayloadRef",
      "dataQualityFlags",
    ],
    lawId: LAW_RESULT_PROOF,
    file: RESULT_BUILDER_PATH,
    message: "Open result builder must mirror the FINAL V2 chain, diagnostic, and data-quality fields into the governed result envelope.",
  },
  {
    functionName: "buildOpenResultOutput",
    requiredFields: [
      "browserSessionRef",
      "browserProfileRef",
      "sourceRef",
      "openAttemptRef",
      "pageStateHandoffRef",
      "pageStateHandoffRequired",
    ],
    lawId: LAW_PAGE_STATE_HANDOFF,
    file: RESULT_BUILDER_PATH,
    message: "Open success output must retain page-state handoff and browser session references.",
  },
] as const;

const PROOF_BUILDER_SPECS: readonly ReturnedObjectSpec[] = [
  {
    functionName: "buildOpenProofChainFields",
    requiredFields: [
      "runId",
      "missionId",
      "sessionId",
      "stepId",
      "mapPackageId",
      "mapPackageVersion",
      "selectedMapId",
      "selectedMapVersion",
      "activationSnapshotRef",
      "capabilityCallId",
      "nerveBusEnvelopeId",
    ],
    lawId: LAW_RESULT_PROOF,
    file: PROOF_BUILDER_PATH,
    message: "Open proof builder must mirror the FINAL V2 execution chain into OpenRuntimeProof.",
  },
  {
    functionName: "buildOpenProofCoreFields",
    requiredFields: ["inputRef", "outputRef", "diagnosticPayloadRef", "browserSessionRef"],
    lawId: LAW_RESULT_PROOF,
    file: PROOF_BUILDER_PATH,
    message: "Open proof builder must retain input/output/diagnostic refs and browserSessionRef.",
  },
  {
    functionName: "buildOpenProofTailFields",
    requiredFields: ["receivedShapeHash"],
    lawId: LAW_RESULT_PROOF,
    file: PROOF_BUILDER_PATH,
    message: "Open proof tail must retain receivedShapeHash for invalid-input proof compatibility.",
  },
] as const;

const DISPATCH_FAILURE_SPECS: readonly ReturnedObjectSpec[] = [
  {
    functionName: "buildOpenDispatchFailureRuntimeProofCoreFields",
    requiredFields: [
      "stepId",
      "mapPackageId",
      "mapPackageVersion",
      "selectedMapId",
      "selectedMapVersion",
      "activationSnapshotRef",
      "capabilityCallId",
      "nerveBusEnvelopeId",
      "inputRef",
      "diagnosticPayloadRef",
      "browserSessionRef",
    ],
    lawId: LAW_RESULT_PROOF,
    file: DISPATCH_FAILURE_BUILDERS_PATH,
    message: "Open dispatch-failure proof builder must retain chain, input, diagnostic, and browser session refs.",
  },
  {
    functionName: "buildOpenDispatchFailureRuntimeProofTailFields",
    requiredFields: ["receivedShapeHash"],
    lawId: LAW_RESULT_PROOF,
    file: DISPATCH_FAILURE_BUILDERS_PATH,
    message: "Open dispatch-failure proof tail must preserve receivedShapeHash for invalid-input proof.",
  },
  {
    functionName: "buildOpenDispatchFailureResultFields",
    requiredFields: [
      "missionId",
      "runId",
      "sessionId",
      "stepId",
      "mapPackageId",
      "mapPackageVersion",
      "selectedMapId",
      "selectedMapVersion",
      "activationSnapshotRef",
      "capabilityCallId",
      "nerveBusEnvelopeId",
      "diagnosticPayloadRef",
      "dataQualityFlags",
    ],
    lawId: LAW_RESULT_PROOF,
    file: DISPATCH_FAILURE_BUILDERS_PATH,
    message: "Open dispatch-failure result builder must retain the FINAL V2 chain and diagnostic fields.",
  },
] as const;

const RECEIVED_SHAPE_HASH_FRAGMENT = 'receivedShapeHash: input.trace.parseDecision === "fallback_trace_only" ? input.trace.receivedShapeHash : null,';

const collectMissingFieldFindings = (input: {
  fields: Set<string>;
  requiredFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
}): Finding[] => {
  const missingFields = input.requiredFields.filter((field) => !input.fields.has(field));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message, detail: missingFields.join(",") })];
};

const collectReturnedObjectFindings = (sourceFile: SourceFile, specs: readonly ReturnedObjectSpec[]): Finding[] => {
  return specs.flatMap((spec) => collectMissingFieldFindings({
    fields: getReturnedObjectPropertyNames(sourceFile, spec.functionName),
    requiredFields: spec.requiredFields,
    lawId: spec.lawId,
    file: spec.file,
    message: spec.message,
  }));
};

const collectResultEnvelopeFindings = (project: Project): Finding[] => {
  const resultBuilderSource = getOpenSourceOrThrow(project, RESULT_BUILDER_PATH);
  return collectReturnedObjectFindings(resultBuilderSource, RESULT_ENVELOPE_SPECS);
};

const collectProofBuilderFindings = (project: Project): Finding[] => {
  const proofBuilderSource = getOpenSourceOrThrow(project, PROOF_BUILDER_PATH);
  return collectReturnedObjectFindings(proofBuilderSource, PROOF_BUILDER_SPECS);
};

const collectDispatchFailureBuilderFindings = (project: Project): Finding[] => {
  const dispatchFailureSource = getOpenSourceOrThrow(project, DISPATCH_FAILURE_BUILDERS_PATH);
  const findings = collectReturnedObjectFindings(dispatchFailureSource, DISPATCH_FAILURE_SPECS);

  if (!dispatchFailureSource.getFullText().includes(RECEIVED_SHAPE_HASH_FRAGMENT)) {
    findings.push(createFinding({
      lawId: LAW_RESULT_PROOF,
      file: DISPATCH_FAILURE_BUILDERS_PATH,
      line: 1,
      severity: "fatal",
      message: "Open dispatch-failure proof tail must derive receivedShapeHash from fallback_trace_only input trace.",
    }));
  }

  return findings;
};

const collectIdempotencyFindings = (project: Project): Finding[] => {
  const idempotencySource = getOpenSourceOrThrow(project, IDEMPOTENCY_PATH);
  return !hasCallExpression(idempotencySource, "buildDuplicateReviewRequiredReservation") || !hasCallExpression(idempotencySource, "buildAlreadyOnTargetReservation")
    ? [createFinding({
      lawId: LAW_RUNTIME_GOVERNANCE,
      file: IDEMPOTENCY_PATH,
      line: 1,
      severity: "fatal",
      message: "Open idempotency gate must fail closed for duplicates and already-on-target decisions.",
    })]
    : [];
};

export const collectChainBuilderFindings = (project: Project): Finding[] => {
  return [
    ...collectResultEnvelopeFindings(project),
    ...collectProofBuilderFindings(project),
    ...collectDispatchFailureBuilderFindings(project),
    ...collectIdempotencyFindings(project),
  ];
};