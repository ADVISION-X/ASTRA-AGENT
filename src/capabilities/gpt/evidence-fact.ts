import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptChildBrowserFact,
  type GptChildCapabilityIntent,
} from "./contract.js";
import { gptExecutionFailure, type GptFailureProofFacts } from "./execution-fault.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { ExactGptCallFacts } from "./product-api.js";
import type { GptEvidenceStorePort } from "./production-ports.js";
import type { GptReasoningRequirementResult } from "./child-types.js";

const reasoningTierUiValue = Object.freeze({
  fast: 0,
  medium: 1,
  high: 2,
  extra_high: 3,
  pro_standard: 4,
});

type GptHash = `sha256:${string}`;

const pendingEvidence = new WeakSet<object>();
export const isPendingExactEvidence = (value: ExactGptCallFacts["evidence"]): boolean =>
  value !== null && pendingEvidence.has(value);

const invalid = (): never => {
  throw executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID");
};

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const stringArray = (value: unknown): readonly string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    ? Object.freeze([...value]) as readonly string[] : null;

const machineCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z][A-Za-z0-9_.:=-]{0,255}$/u.test(value);

const hashValue = (value: unknown): value is GptHash =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);

const exactKeys = (value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
};

const validCount = (value: unknown): value is number | null =>
  value === null || (Number.isSafeInteger(value) && Number(value) >= 0);

const failureCause = (value: unknown): Error | undefined => {
  if (value === null) return undefined;
  const cause = record(value);
  if (!cause) return invalid();
  const name = cause.name;
  const code = cause.code;
  if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(name)
    || !(code === null || machineCode(code))) invalid();
  return Object.assign(new Error(String(name)), {
    name: String(name),
    ...(code ? { code: String(code) } : {}),
  });
};

const browserOutcomeMatchesMutation = (
  outcome: unknown,
  mutation: unknown,
  expected: EvidenceState["mutation"],
): boolean => mutation === expected && (
  (outcome === "DISPATCHED" && mutation === "dispatched")
  || (outcome === "CONFIRMED" && (mutation === "no" || mutation === "confirmed"))
  || (outcome === "REJECTED" && (mutation === "no" || mutation === "confirmed" || mutation === "dispatched"))
);

const browserFactIdentityValid = (input: Readonly<{
  fact: Readonly<Record<string, unknown>>;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: GptHash;
  expectedScope: "provider_effect" | "target_local";
}>): boolean => input.fact.exact_call_identity_hash === input.exactCallIdentityHash
  && input.fact.child_capability_id === input.intent.childCapabilityId
  && input.fact.effect_scope === input.expectedScope;

const browserFactEvidenceValid = (fact: Readonly<Record<string, unknown>>): boolean => {
  const terminalAt = fact.terminal_at;
  const terminalValid = terminalAt === null || (typeof terminalAt === "string"
    && !Number.isNaN(Date.parse(terminalAt)) && new Date(terminalAt).toISOString() === terminalAt);
  return terminalValid && typeof fact.evidence_ref === "string" && fact.evidence_ref.length > 0
    && hashValue(fact.evidence_hash);
};

const failureBrowserFact = (input: Readonly<{
  value: unknown;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: GptHash;
  mutation: EvidenceState["mutation"];
}>): GptChildBrowserFact | null => {
  if (input.value === null) return null;
  const fact = record(input.value);
  if (!fact) return invalid();
  if (!exactKeys(fact, [
    "exact_call_identity_hash", "child_capability_id", "effect_scope", "browser_outcome",
    "mutation_outcome", "terminal_at", "evidence_ref", "evidence_hash",
  ])) return invalid();
  const outcome = fact.browser_outcome;
  const mutation = fact.mutation_outcome;
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId];
  const expectedScope = contract.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local";
  const terminalAt = fact.terminal_at;
  if (!browserFactIdentityValid({ fact, intent: input.intent,
    exactCallIdentityHash: input.exactCallIdentityHash, expectedScope })
    || !browserOutcomeMatchesMutation(outcome, mutation, input.mutation)
    || !browserFactEvidenceValid(fact)) return invalid();
  return Object.freeze({
    exactCallIdentityHash: input.exactCallIdentityHash,
    childCapabilityId: input.intent.childCapabilityId,
    effectScope: expectedScope,
    browserOutcome: outcome as GptChildBrowserFact["browserOutcome"],
    mutationOutcome: mutation as GptChildBrowserFact["mutationOutcome"],
    terminalAt: terminalAt as string | null,
    evidenceRef: fact.evidence_ref as string,
    evidenceHash: fact.evidence_hash as GptHash,
  });
};

const failureProofHeaderValid = (
  proof: Readonly<Record<string, unknown>>,
  factResultIds: readonly string[] | null,
  authorityRefHashes: readonly string[] | null,
): boolean => exactKeys(proof, [
  "internal_decision_code", "fact_result_ids", "authority_ref_hashes", "observation_revision_hash",
  "browser_fact", "native_failure_code",
]) && proof.internal_decision_code === "FAIL_CLOSED" && factResultIds !== null
  && authorityRefHashes !== null && authorityRefHashes.every(hashValue);

const failureProofDetailsValid = (
  cardinality: Readonly<Record<string, unknown>> | null,
  observationRevisionHash: unknown,
  nativeFailureCode: unknown,
): boolean => cardinality !== null && exactKeys(cardinality, ["raw", "eligible"])
  && validCount(cardinality.raw) && validCount(cardinality.eligible)
  && (observationRevisionHash === null || hashValue(observationRevisionHash))
  && (nativeFailureCode === null || machineCode(nativeFailureCode));

const failureProofFacts = (input: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: GptHash;
  mutation: EvidenceState["mutation"];
}>): GptFailureProofFacts => {
  const proof = record(input.payload.failure_proof);
  const cardinality = record(input.payload.candidate_cardinality);
  const factResultIds = proof ? stringArray(proof.fact_result_ids) : null;
  const authorityRefHashes = proof ? stringArray(proof.authority_ref_hashes) : null;
  const observationRevisionHash = proof?.observation_revision_hash;
  const nativeFailureCode = proof?.native_failure_code;
  if (!proof) return invalid();
  if (!failureProofHeaderValid(proof, factResultIds, authorityRefHashes)
    || !failureProofDetailsValid(cardinality, observationRevisionHash, nativeFailureCode)) return invalid();
  const exactCardinality = cardinality!;
  return Object.freeze({
    decision: "FAIL_CLOSED", factResultIds: factResultIds as readonly string[],
    candidateCardinality: Object.freeze({
      raw: exactCardinality.raw as number | null, eligible: exactCardinality.eligible as number | null,
    }),
    authorityRefHashes: authorityRefHashes as readonly GptHash[],
    observationRevisionHash: observationRevisionHash as GptHash | null,
    mutationOutcome: input.mutation,
    browserFact: failureBrowserFact({ ...input, value: proof.browser_fact }),
    nativeFailureCode: nativeFailureCode as string | null,
  });
};

type EvidenceState = Readonly<{
  postcondition: "passed" | "failed" | "pending";
  resultStatus: "success" | "failed";
  failureCode: string | null;
  mutation: "no" | "confirmed" | "dispatched";
}>;

const evidenceEnumsValid = (
  postcondition: unknown,
  resultStatus: unknown,
  mutation: unknown,
): boolean => (postcondition === "passed" || postcondition === "failed" || postcondition === "pending")
  && (resultStatus === "success" || resultStatus === "failed")
  && (mutation === "no" || mutation === "confirmed" || mutation === "dispatched");

const evidencePairValid = (
  postcondition: unknown,
  resultStatus: unknown,
  failure: unknown,
  mutation: unknown,
  terminalKey: boolean,
  postSubmitReadbackRecovery: boolean,
): boolean => !(terminalKey && postcondition === "pending")
  && !(resultStatus === "success" && (postcondition !== "passed" || failure !== null))
  && !(resultStatus === "failed" && (!machineCode(failure) || postcondition === "passed"))
  && !(postcondition === "pending" && typeof failure === "string"
    && failure.startsWith("GPT_PROVIDER_TERMINAL_"))
  && !(postcondition === "pending"
    && (resultStatus !== "failed" || (mutation !== "dispatched" && mutation !== "confirmed"
      && !(mutation === "no" && postSubmitReadbackRecovery && !terminalKey))));

const evidenceState = (
  payload: Readonly<Record<string, unknown>>,
  terminalKey: boolean,
  postSubmitReadbackRecovery: boolean,
): EvidenceState => {
  const postcondition = payload.postcondition_result;
  const resultStatus = payload.result_status;
  const failure = payload.failure_code;
  const mutation = payload.committed_mutation;
  if (!evidenceEnumsValid(postcondition, resultStatus, mutation)
    || !evidencePairValid(
      postcondition, resultStatus, failure, mutation, terminalKey, postSubmitReadbackRecovery,
    )) invalid();
  return {
    postcondition: postcondition as EvidenceState["postcondition"],
    resultStatus: resultStatus as EvidenceState["resultStatus"],
    failureCode: failure as string | null,
    mutation: mutation as EvidenceState["mutation"],
  };
};

const safeIntegerOrNull = (value: unknown): value is number | null =>
  value === null || Number.isSafeInteger(value);

const reasoningShapeValid = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
): boolean => exactKeys(result, [
  "requestedTier", "requestedValue", "selectionPolicy", "observedScale",
  "resolvedTier", "resolvedValue", "degraded", "currentValue",
  "mutationOutcome", "browserOutcome", "gptPostcondition",
]) && exactKeys(observedScale, ["min", "max", "currentBefore"]);

const reasoningRequestValid = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
): boolean => typeof result.requestedTier === "string"
  && result.requestedTier in reasoningTierUiValue
  && result.requestedValue === reasoningTierUiValue[result.requestedTier as keyof typeof reasoningTierUiValue]
  && (result.selectionPolicy === "exact" || result.selectionPolicy === "exact-or-observed-maximum")
  && !(result.selectionPolicy === "exact-or-observed-maximum" && result.requestedTier !== "pro_standard")
  && safeIntegerOrNull(observedScale.min)
  && safeIntegerOrNull(observedScale.max)
  && safeIntegerOrNull(observedScale.currentBefore);

const reasoningResultFieldsValid = (
  result: Readonly<Record<string, unknown>>,
  state: EvidenceState,
): boolean => (result.resolvedTier === null
  || (typeof result.resolvedTier === "string" && result.resolvedTier in reasoningTierUiValue))
  && safeIntegerOrNull(result.resolvedValue)
  && typeof result.degraded === "boolean"
  && safeIntegerOrNull(result.currentValue)
  && result.mutationOutcome === state.mutation
  && result.gptPostcondition === state.postcondition
  && ((result.browserOutcome === null && result.mutationOutcome === "no")
    || browserOutcomeMatchesMutation(result.browserOutcome, result.mutationOutcome, state.mutation));

const exactReasoningResolutionValid = (result: Readonly<Record<string, unknown>>): boolean =>
  (result.resolvedTier === null) === (result.resolvedValue === null)
  && !(result.selectionPolicy === "exact" && result.resolvedTier !== null
    && (result.resolvedTier !== result.requestedTier
      || result.resolvedValue !== result.requestedValue || result.degraded !== false));

const adaptiveReasoningResolutionValid = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
): boolean => {
  if (result.degraded && !validDegradedReasoningResolution(result, observedScale)) return false;
  if (result.selectionPolicy !== "exact-or-observed-maximum" || result.resolvedTier === null) return true;
  return validObservedMaximumResolution(result, observedScale);
};

const validDegradedReasoningResolution = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
): boolean => result.selectionPolicy === "exact-or-observed-maximum"
  && result.requestedTier === "pro_standard"
  && observedScale.min === 0
  && observedScale.max === 2
  && result.resolvedTier === "high"
  && result.resolvedValue === 2;

const validObservedMaximumResolution = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
): boolean => observedScale.min === 0 && (
  (observedScale.max === 2 && result.resolvedTier === "high"
    && result.resolvedValue === 2 && result.degraded === true)
  || (observedScale.max === 4 && result.resolvedTier === "pro_standard"
    && result.resolvedValue === 4 && result.degraded === false)
);

const successfulReasoningResultValid = (
  result: Readonly<Record<string, unknown>>,
  state: EvidenceState,
): boolean => state.resultStatus !== "success" || (result.resolvedTier !== null
  && result.currentValue === result.resolvedValue && result.gptPostcondition === "passed");

const reasoningPayloadValid = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
  state: EvidenceState,
): boolean => [
  reasoningShapeValid(result, observedScale),
  reasoningRequestValid(result, observedScale),
  reasoningResultFieldsValid(result, state),
  exactReasoningResolutionValid(result),
  adaptiveReasoningResolutionValid(result, observedScale),
  successfulReasoningResultValid(result, state),
].every(Boolean);

const decodedReasoningResult = (
  result: Readonly<Record<string, unknown>>,
  observedScale: Readonly<Record<string, unknown>>,
): GptReasoningRequirementResult => Object.freeze({
  requestedTier: result.requestedTier as GptReasoningRequirementResult["requestedTier"],
  requestedValue: result.requestedValue as number,
  selectionPolicy: result.selectionPolicy as GptReasoningRequirementResult["selectionPolicy"],
  observedScale: Object.freeze({
    min: observedScale.min as number | null,
    max: observedScale.max as number | null,
    currentBefore: observedScale.currentBefore as number | null,
  }),
  resolvedTier: result.resolvedTier as GptReasoningRequirementResult["resolvedTier"],
  resolvedValue: result.resolvedValue as number | null,
  degraded: result.degraded as boolean,
  currentValue: result.currentValue as number | null,
  mutationOutcome: result.mutationOutcome as GptReasoningRequirementResult["mutationOutcome"],
  browserOutcome: result.browserOutcome as GptReasoningRequirementResult["browserOutcome"],
  gptPostcondition: result.gptPostcondition as GptReasoningRequirementResult["gptPostcondition"],
});

const reasoningRequirementResult = (input: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  intent: GptChildCapabilityIntent;
  state: EvidenceState;
}>): GptReasoningRequirementResult | null => {
  const value = input.payload.reasoning_requirement_result;
  if (input.intent.childCapabilityId !== "ensure_gpt_reasoning_requirement") {
    if (value !== null) invalid();
    return null;
  }
  const result = record(value);
  if (!result) return invalid();
  const observedScale = record(result.observedScale);
  if (!observedScale) return invalid();
  if (!reasoningPayloadValid(result, observedScale, input.state)) return invalid();
  return decodedReasoningResult(result, observedScale);
};

const assertIdentity = (input: Readonly<{
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: `sha256:${string}`;
  stored: NonNullable<Awaited<ReturnType<GptEvidenceStorePort["readExactCallEvidence"]>>>;
  payload: Readonly<Record<string, unknown>>;
  artifactRefs: readonly string[] | null;
}>): boolean => {
  const { record: evidenceRecord } = input.stored;
  const initialKey = `gpt-call-evidence:v1:${input.exactCallIdentityHash}`;
  const terminalKey = `gpt-call-terminal-evidence:v1:${input.exactCallIdentityHash}`;
  const isTerminal = evidenceRecord.idempotencyKey === terminalKey;
  if (evidenceRecord.missionId !== input.intent.jobId
    || evidenceRecord.runId !== input.intent.attemptId
    || evidenceRecord.stepId !== input.intent.productStepId
    || evidenceRecord.sourceAbilityGroupId !== "gpt"
    || evidenceRecord.sourceChildCapabilityId !== input.intent.childCapabilityId
    || (!isTerminal && evidenceRecord.idempotencyKey !== initialKey)
    || input.payload.exact_call_identity_hash !== input.exactCallIdentityHash
    || input.payload.action_ordinal !== input.intent.actionOrdinal
    || input.payload.plugin_version !== input.intent.pluginVersion
    || input.artifactRefs === null) invalid();
  return isTerminal;
};

type VerifiedExactGptEvidence = Readonly<{
  recordRef: string;
  evidenceHash: GptHash;
  artifactRefs: readonly string[];
  payload: Readonly<Record<string, unknown>>;
  state: EvidenceState;
  reasoningResult: GptReasoningRequirementResult | null;
  cause: Error | undefined;
  terminal: boolean;
}>;

const readVerifiedExactGptEvidence = async (input: Readonly<{
  evidenceStore: GptEvidenceStorePort;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: `sha256:${string}`;
  postSubmitReadbackRecovery?: boolean;
}>): Promise<VerifiedExactGptEvidence | null> => {
  const stored = await input.evidenceStore.readExactCallEvidence({
    missionId: input.intent.jobId,
    runId: input.intent.attemptId,
    exactCallIdentityHash: input.exactCallIdentityHash,
  });
  if (!stored) return null;
  const payload = record(stored.record.payload);
  const artifactRefs = stringArray(stored.record.artifactRefs ?? []);
  const evidenceHash = payload?.source_evidence_hash;
  if (!payload || !hashValue(evidenceHash)) return invalid();
  if (payload.schema_version !== "agent-gpt-evidence-safe.v2") invalid();
  const terminalKey = assertIdentity({ ...input, stored, payload, artifactRefs });
  const state = evidenceState(payload, terminalKey, input.postSubmitReadbackRecovery === true);
  const reasoningResult = reasoningRequirementResult({ payload, intent: input.intent, state });
  const cause = failureCause(payload.failure_cause);
  return Object.freeze({
    recordRef: stored.recordRef,
    evidenceHash,
    artifactRefs: artifactRefs!,
    payload,
    state,
    reasoningResult,
    cause,
    terminal: terminalKey,
  });
};

export const readExactGptEvidenceFact = async (input: Readonly<{
  evidenceStore: GptEvidenceStorePort;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: `sha256:${string}`;
  postSubmitReadbackRecovery?: boolean;
}>): Promise<ExactGptCallFacts["evidence"]> => {
  const verified = await readVerifiedExactGptEvidence(input);
  if (!verified) return null;
  const { payload, state, reasoningResult, cause } = verified;
  const failedInitialReadbackRemainsPending = input.postSubmitReadbackRecovery === true
    && !verified.terminal
    && state.postcondition === "failed"
    && state.resultStatus === "failed"
    && state.mutation === "no"
    && !state.failureCode?.startsWith("GPT_PROVIDER_TERMINAL_");
  const proofFacts = state.resultStatus === "failed" ? failureProofFacts({
    payload, intent: input.intent,
    exactCallIdentityHash: input.exactCallIdentityHash, mutation: state.mutation,
  }) : null;
  if (state.postcondition === "failed" && !failedInitialReadbackRemainsPending) {
    const browserFact = proofFacts!.browserFact;
    throw gptExecutionFailure(state.failureCode!, {
      mutationOutcome: state.mutation,
      evidence: Object.freeze({
        evidenceRef: browserFact?.evidenceRef ?? verified.recordRef,
        evidenceHash: browserFact?.evidenceHash ?? verified.evidenceHash,
      }),
      browserEffect: browserFact ? Object.freeze({
        effectScope: browserFact.effectScope,
        childCapabilityId: browserFact.childCapabilityId,
        browserOutcome: browserFact.browserOutcome,
      }) : null,
      proofFacts: proofFacts!,
      reasoningRequirementResult: reasoningResult,
      ...(cause ? { cause } : {}),
    });
  }
  if (state.postcondition === "passed" && payload.failure_cause !== null) invalid();
  const fact = Object.freeze({
    owner: "forensics-persistence" as const,
    evidenceRef: verified.recordRef,
    evidenceHash: verified.evidenceHash,
    readbackVerified: true as const,
    artifactRefs: verified.artifactRefs,
  });
  if (state.postcondition === "pending" || failedInitialReadbackRemainsPending) pendingEvidence.add(fact);
  return fact;
};
