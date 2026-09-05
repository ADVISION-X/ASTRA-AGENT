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
import { reasoningTierUiValue } from "./web/contracts/execution-profile.contract.js";

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
): boolean => !(terminalKey && postcondition === "pending")
  && !(resultStatus === "success" && (postcondition !== "passed" || failure !== null))
  && !(resultStatus === "failed" && (!machineCode(failure) || postcondition === "passed"))
  && !(postcondition === "pending" && (resultStatus !== "failed" || mutation !== "dispatched"));

const evidenceState = (
  payload: Readonly<Record<string, unknown>>,
  terminalKey: boolean,
): EvidenceState => {
  const postcondition = payload.postcondition_result;
  const resultStatus = payload.result_status;
  const failure = payload.failure_code;
  const mutation = payload.committed_mutation;
  if (!evidenceEnumsValid(postcondition, resultStatus, mutation)
    || !evidencePairValid(postcondition, resultStatus, failure, mutation, terminalKey)) invalid();
  return {
    postcondition: postcondition as EvidenceState["postcondition"],
    resultStatus: resultStatus as EvidenceState["resultStatus"],
    failureCode: failure as string | null,
    mutation: mutation as EvidenceState["mutation"],
  };
};

const safeIntegerOrNull = (value: unknown): value is number | null =>
  value === null || Number.isSafeInteger(value);

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
  if (!exactKeys(result, [
      "requestedTier", "requestedValue", "selectionPolicy", "observedScale",
      "resolvedTier", "resolvedValue", "degraded", "currentValue",
      "mutationOutcome", "browserOutcome", "gptPostcondition",
    ])
    || !exactKeys(observedScale, ["min", "max", "currentBefore"])) return invalid();
  const requestedTier = result.requestedTier;
  const requestedValue = result.requestedValue;
  const selectionPolicy = result.selectionPolicy;
  const resolvedTier = result.resolvedTier;
  const resolvedValue = result.resolvedValue;
  const degraded = result.degraded;
  const browserOutcome = result.browserOutcome;
  const gptPostcondition = result.gptPostcondition;
  if (typeof requestedTier !== "string" || !(requestedTier in reasoningTierUiValue)
    || requestedValue !== reasoningTierUiValue[requestedTier as keyof typeof reasoningTierUiValue]
    || (selectionPolicy !== "exact" && selectionPolicy !== "exact-or-observed-maximum")
    || (selectionPolicy === "exact-or-observed-maximum" && requestedTier !== "pro_standard")
    || !(resolvedTier === null
      || (typeof resolvedTier === "string" && resolvedTier in reasoningTierUiValue))
    || !safeIntegerOrNull(resolvedValue)
    || typeof degraded !== "boolean"
    || !safeIntegerOrNull(observedScale.min)
    || !safeIntegerOrNull(observedScale.max)
    || !safeIntegerOrNull(observedScale.currentBefore)
    || !safeIntegerOrNull(result.currentValue)
    || result.mutationOutcome !== input.state.mutation
    || gptPostcondition !== input.state.postcondition
    || !((browserOutcome === null && result.mutationOutcome === "no")
      || browserOutcomeMatchesMutation(browserOutcome, result.mutationOutcome, input.state.mutation))) invalid();
  if ((resolvedTier === null) !== (resolvedValue === null)) invalid();
  if (selectionPolicy === "exact" && resolvedTier !== null
    && (resolvedTier !== requestedTier || resolvedValue !== requestedValue || degraded)) invalid();
  if (degraded && !(selectionPolicy === "exact-or-observed-maximum"
    && requestedTier === "pro_standard" && observedScale.min === 0 && observedScale.max === 2
    && resolvedTier === "high" && resolvedValue === 2)) invalid();
  if (selectionPolicy === "exact-or-observed-maximum" && resolvedTier !== null) {
    const validAdaptive = observedScale.min === 0 && (
      (observedScale.max === 2 && resolvedTier === "high" && resolvedValue === 2 && degraded)
      || (observedScale.max === 4 && resolvedTier === "pro_standard"
        && resolvedValue === 4 && !degraded)
    );
    if (!validAdaptive) invalid();
  }
  if (input.state.resultStatus === "success" && (resolvedTier === null
    || result.currentValue !== resolvedValue || gptPostcondition !== "passed")) invalid();
  return Object.freeze({
    requestedTier: requestedTier as GptReasoningRequirementResult["requestedTier"],
    requestedValue: requestedValue as number,
    selectionPolicy: selectionPolicy as GptReasoningRequirementResult["selectionPolicy"],
    observedScale: Object.freeze({
      min: observedScale.min as number | null,
      max: observedScale.max as number | null,
      currentBefore: observedScale.currentBefore as number | null,
    }),
    resolvedTier: resolvedTier as GptReasoningRequirementResult["resolvedTier"],
    resolvedValue: resolvedValue as number | null,
    degraded: degraded as boolean,
    currentValue: result.currentValue as number | null,
    mutationOutcome: result.mutationOutcome as GptReasoningRequirementResult["mutationOutcome"],
    browserOutcome: browserOutcome as GptReasoningRequirementResult["browserOutcome"],
    gptPostcondition: gptPostcondition as GptReasoningRequirementResult["gptPostcondition"],
  });
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

export const readExactGptEvidenceFact = async (input: Readonly<{
  evidenceStore: GptEvidenceStorePort;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: `sha256:${string}`;
}>): Promise<ExactGptCallFacts["evidence"]> => {
  const stored = await input.evidenceStore.readExactCallEvidence({
    missionId: input.intent.jobId,
    runId: input.intent.attemptId,
    exactCallIdentityHash: input.exactCallIdentityHash,
  });
  if (!stored) return null;
  const payload = record(stored.record.payload);
  const artifactRefs = stringArray(stored.record.artifactRefs ?? []);
  const evidenceHash = payload?.source_evidence_hash;
  if (!payload) return invalid();
  const verifiedPayload = payload as Readonly<Record<string, unknown>>;
  if (verifiedPayload.schema_version !== "agent-gpt-evidence-safe.v2"
    || typeof evidenceHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(evidenceHash)) invalid();
  const terminalKey = assertIdentity({ ...input, stored, payload: verifiedPayload, artifactRefs });
  const state = evidenceState(verifiedPayload, terminalKey);
  const reasoningResult = reasoningRequirementResult({ payload: verifiedPayload, intent: input.intent, state });
  const cause = failureCause(verifiedPayload.failure_cause);
  if (state.postcondition === "failed") {
    const proofFacts = failureProofFacts({
      payload: verifiedPayload, intent: input.intent,
      exactCallIdentityHash: input.exactCallIdentityHash, mutation: state.mutation,
    });
    const browserFact = proofFacts.browserFact;
    throw gptExecutionFailure(state.failureCode!, {
      mutationOutcome: state.mutation,
      evidence: Object.freeze({
        evidenceRef: browserFact?.evidenceRef ?? stored.recordRef,
        evidenceHash: browserFact?.evidenceHash ?? evidenceHash as GptHash,
      }),
      browserEffect: browserFact ? Object.freeze({
        effectScope: browserFact.effectScope,
        childCapabilityId: browserFact.childCapabilityId,
        browserOutcome: browserFact.browserOutcome,
      }) : null,
      proofFacts,
      reasoningRequirementResult: reasoningResult,
      ...(cause ? { cause } : {}),
    });
  }
  if (state.postcondition === "passed" && verifiedPayload.failure_cause !== null) invalid();
  const fact = Object.freeze({
    owner: "forensics-persistence" as const,
    evidenceRef: stored.recordRef,
    evidenceHash: evidenceHash as GptHash,
    readbackVerified: true as const,
    artifactRefs: artifactRefs!,
  });
  if (state.postcondition === "pending") pendingEvidence.add(fact);
  return fact;
};
