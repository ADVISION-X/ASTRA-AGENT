import type {
  ParsedPostActionVerificationAbilityInput,
  PostActionVerificationAbilityResult,
} from "../contract.js";
import type { PostActionChildObservation } from "./post-action-verification-runtime-context.js";
import { buildPostActionRuntimeProof } from "./post-action-runtime-proof-builder.js";

type RuntimeRefs = {
  debugLogRef: string;
  structuredRuntimeEventRef: string | null;
};

type SuccessfulRuntimeProofInput = {
  childObservation: PostActionChildObservation;
  observationFingerprint: string;
  outputRef: string;
  refs: RuntimeRefs;
  request: ParsedPostActionVerificationAbilityInput;
  startedAt: { isoTimestamp: string; monotonicMs: number };
  endedAt: { isoTimestamp: string; monotonicMs: number };
};

type SuccessfulResultPayloadInput = {
  afterEvidenceRefs: string[];
  beforeEvidenceRefs: string[];
  childObservation: PostActionChildObservation;
  observationFingerprint: string;
  outputRef: string;
  refs: RuntimeRefs;
  request: ParsedPostActionVerificationAbilityInput;
  requestFields: Pick<
    PostActionVerificationAbilityResult,
    | "childCapabilityId"
    | "missionId"
    | "runId"
    | "sessionId"
    | "roundId"
    | "videoVisitId"
    | "stepId"
    | "bindingPackageId"
    | "bindingPackageVersion"
    | "selectedBindingId"
    | "bindingVersion"
    | "bindingSnapshotRef"
    | "capabilityCallId"
    | "nerveBusEnvelopeId"
    | "actionProofRef"
    | "expectedOutcome"
  >;
  runtimeProof: ReturnType<typeof buildSuccessfulRuntimeProof>;
};

const buildSuccessfulPostActionOutput = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  observationFingerprint: string;
}) => ({
  packageLabel: input.childObservation.packageLabel,
  observationSummary: input.childObservation.observationSummary,
  evidenceRefs: input.childObservation.supportingEvidenceRefs,
  observationRefs: input.childObservation.supportingObservationRefs,
  postActionObservationRef: `${input.request.inputRef}:post-action-observation`,
  actionObservationBundleRef: `${input.request.inputRef}:action-observation-bundle`,
  observationFingerprint: input.observationFingerprint,
  supportingSourceProofRefs: input.childObservation.supportingSourceProofRefs,
});

export const buildSuccessfulRuntimeProof = (input: SuccessfulRuntimeProofInput) => {
  return buildPostActionRuntimeProof({
    request: input.request,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    observationRefs: input.childObservation.supportingObservationRefs,
    evidenceRefs: input.childObservation.supportingEvidenceRefs,
    outputRef: input.outputRef,
    diagnosticPayloadRef: null,
    debugLogRef: input.refs.debugLogRef,
    structuredRuntimeEventRef: input.refs.structuredRuntimeEventRef,
    receivedShapeHash: null,
    processingMode: "observation_packaging",
    observationFingerprint: input.observationFingerprint,
    dataQualityFlags: input.childObservation.dataQualityFlags,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
};

export const buildSuccessfulResultPayload = (input: SuccessfulResultPayloadInput): PostActionVerificationAbilityResult => ({
  ...input.requestFields,
  status: "success",
  abilityGroupId: "post-action-verification",
  postActionVerificationResultRef: input.outputRef,
  sourceActionResultRef: input.request.actionProof.sourceActionResultRef,
  sourceActionRuntimeProofRef: input.request.actionProof.sourceRuntimeProofRef,
  sourceActionAbilityGroupId: input.request.sourceAbilityGroupId,
  sourceActionChildCapabilityId: input.request.sourceChildCapabilityId,
  beforeEvidenceRefs: input.beforeEvidenceRefs,
  afterEvidenceRefs: input.afterEvidenceRefs,
  observationRefs: input.childObservation.supportingObservationRefs,
  supportingSourceProofRefs: input.childObservation.supportingSourceProofRefs,
  observationFingerprint: input.observationFingerprint,
  packageStatus: "built",
  output: buildSuccessfulPostActionOutput({
    request: input.request,
    childObservation: input.childObservation,
    observationFingerprint: input.observationFingerprint,
  }),
  failureReason: null,
  reviewRequiredReason: null,
  statusMessage: input.childObservation.statusMessage,
  debugLogRef: input.refs.debugLogRef,
  structuredRuntimeEventRef: input.refs.structuredRuntimeEventRef,
  diagnosticPayloadRef: null,
  runtimeProof: input.runtimeProof,
  dataQualityFlags: input.childObservation.dataQualityFlags,
});