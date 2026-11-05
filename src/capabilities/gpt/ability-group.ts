import { createHash } from "node:crypto";
import { executionFailure, executionFailureCause, executionFailureMetadata, failureCode } from "../../lib/execution-failure.js";
import { knownGptRateLimitPreflightFactValid, typedBrowserExecutionFailure } from "../../lib/browser/browser-authority-api.js";
import { runtimeLogCauseEventId, withRuntimeLogCauseFact } from "../../lib/runtime-logs/index.js";
import { GPT_CHILD_CAPABILITY_CONTRACTS, gptExactCallIdentityHash, type GptAbilityGroup, type GptChildBrowserFact,
  type GptChildCapabilityId, type GptChildCapabilityIntent, type GptChildCapabilityProof, type GptChildCapabilityResult,
  type GptChildOutputMap, type GptExecutionContext, type GptReasoningRequirementResult } from "./contract.js";
import { projectBrowserFact, type GptChildHandler, type GptChildObservation } from "./web/child-handler.js";
import { gptChildHandlers } from "./handler-registry.js";
import { typedGptExecutionFailure, type GptFailureProofFacts } from "./execution-fault.js";

const hash = (text: string): `sha256:${string}` => `sha256:${createHash("sha256").update(text).digest("hex")}`;
type ProofObservation = GptFailureProofFacts & Readonly<{ postconditionResult?: "passed" }>;
const absentProofFacts = (intent: GptChildCapabilityIntent, code: string | undefined, nativeFailureCode: string | null): ProofObservation => ({
  decision: "FAIL_CLOSED", factResultIds: [`gpt-fact-result:${hash(JSON.stringify({ childCapabilityId: intent.childCapabilityId,
    failureCode: code ?? null, nativeFailureCode })).slice(7)}`], authorityRefHashes: [], candidateCardinality: { raw: null, eligible: null },
  observationRevisionHash: null, mutationOutcome: "no", browserFact: null, nativeFailureCode });
const proofFor = (input: Readonly<{ intent: GptChildCapabilityIntent; startedAt: string; observation?: ProofObservation;
  code?: string; nativeFailureCode?: string | null; committedMutation?: "no" | "dispatched" | "confirmed";
  postconditionResult?: "passed" | "failed" | "pending" }>): GptChildCapabilityProof => {
  const { intent } = input, failed = input.code !== undefined;
  const observed = input.observation ?? absentProofFacts(intent, input.code, input.nativeFailureCode ?? null);
  const unsigned = { schemaVersion: "gpt-child-capability-proof.v2" as const, childCapabilityId: intent.childCapabilityId,
    childContractVersion: GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].contractVersion,
    childStatus: failed ? "failed" as const : "success" as const, childReasonCode: input.code ?? "GPT_CHILD_SUCCESS",
    exactCallIdentityHash: gptExactCallIdentityHash(intent), internalDecisionCode: failed ? "FAIL_CLOSED" as const : observed.decision,
    executionId: intent.executionId, jobId: intent.jobId, attemptId: intent.attemptId, resultRevision: intent.resultRevision,
    productStepId: intent.productStepId, callId: intent.callId, inputHash: intent.inputHash, actionOrdinal: intent.actionOrdinal,
    authorityRefHashes: Object.freeze([...new Set(observed.authorityRefHashes)]), factResultIds: observed.factResultIds,
    candidateCardinality: observed.candidateCardinality, observationRevisionHash: observed.observationRevisionHash,
    committedMutation: input.committedMutation ?? observed.mutationOutcome,
    postconditionResult: input.postconditionResult ?? observed.postconditionResult ?? "failed", browserFact: observed.browserFact,
    nativeFailureCode: input.nativeFailureCode ?? observed.nativeFailureCode,
    ...(observed.emptyEndedAt ? { emptyEndedAt: observed.emptyEndedAt } : {}),
    ...(observed.stoppedEmptyProof ? { stoppedEmptyProof: observed.stoppedEmptyProof } : {}),
    startedAt: input.startedAt, endedAt: new Date().toISOString() };
  const evidenceHash = hash(JSON.stringify({ ...unsigned, startedAt: null, endedAt: null }));
  return Object.freeze({ ...unsigned, evidenceRef: `gpt-child-proof:${intent.executionId}:${evidenceHash.slice(7, 23)}`, evidenceHash });
};
const rateLimitFact = (intent: GptChildCapabilityIntent, error: unknown, code: string): GptChildBrowserFact | null => {
  const metadata = executionFailureMetadata(error), preflight = metadata?.knownGptRateLimitPreflightFact, evidence = metadata?.evidence;
  const state = code === "BROWSER_KNOWN_GPT_RATE_LIMIT" ? "exact_present" : code === "BROWSER_GPT_DIALOG_UNRECOGNIZED" ? "mismatch" : null;
  if (!evidence || !state || preflight?.state !== state || !knownGptRateLimitPreflightFactValid(preflight)
    || evidence.evidenceHash !== preflight.observationHash) return null;
  const kind = state === "exact_present" ? "browser-known-gpt-rate-limit" : "browser-gpt-dialog-unrecognized";
  if (evidence.evidenceRef !== [kind, preflight.observedAt, preflight.exactCallIdentityHash, preflight.targetRefHash, preflight.documentRefHash].join("|")) return null;
  return Object.freeze({ exactCallIdentityHash: gptExactCallIdentityHash(intent), providerEffectIdentityHash: null,
    childCapabilityId: intent.childCapabilityId, effectScope: "target_local", browserOutcome: "REJECTED", mutationOutcome: "no", terminalAt: null,
    evidenceRef: evidence.evidenceRef, evidenceHash: evidence.evidenceHash, knownGptRateLimitPreflightFact: preflight });
};
const errorFacts = (error: unknown, observed?: ProofObservation) => {
  const code = failureCode(error, "GPT_CHILD_UNCLASSIFIED_FAILURE"), nativeCause = executionFailureCause(error);
  const gpt = typedGptExecutionFailure(error), browser = typedBrowserExecutionFailure(error), evidence = executionFailureMetadata(error)?.evidence;
  const source = observed ?? gpt?.proofFacts ?? (evidence ? { decision: "FAIL_CLOSED" as const, factResultIds: [evidence.evidenceRef],
    candidateCardinality: { raw: 1, eligible: 1 }, authorityRefHashes: [evidence.evidenceHash], observationRevisionHash: evidence.evidenceHash,
    mutationOutcome: "no" as const, browserFact: null, nativeFailureCode: null } : undefined);
  return { code, nativeCause, source, mutationOutcome: browser?.mutationOutcome ?? gpt?.mutationOutcome ?? "no",
    browserEffect: gpt?.browserEffect ?? browser?.browserEffect ?? null, reasoningRequirementResult: gpt?.reasoningRequirementResult ?? null };
};
const failureObservation = (source: ProofObservation | undefined, fact: GptChildBrowserFact | null,
  nativeFailureCode: string | null): ProofObservation | undefined => {
  if (!source && !fact) return undefined;
  const base: ProofObservation = source ?? { decision: "FAIL_CLOSED", factResultIds: [], candidateCardinality: { raw: null, eligible: null },
    authorityRefHashes: [], observationRevisionHash: null, mutationOutcome: "no", browserFact: null, nativeFailureCode };
  const browserFact = fact ?? base.browserFact;
  return Object.freeze({ ...base, mutationOutcome: browserFact?.mutationOutcome ?? base.mutationOutcome, browserFact,
    factResultIds: Object.freeze([...new Set([...base.factResultIds, ...(browserFact ? [browserFact.evidenceRef] : [])])]),
    authorityRefHashes: Object.freeze([...new Set([...base.authorityRefHashes, ...(browserFact ? [browserFact.evidenceHash] : [])])]) });
};
const failureEffect = (fact: GptChildBrowserFact | null | undefined, fallback: GptChildCapabilityResult["failureBrowserEffect"]) => {
  const source = fact ?? fallback;
  return source ? Object.freeze({ effectScope: source.effectScope, childCapabilityId: source.childCapabilityId,
    browserOutcome: source.browserOutcome, providerEffectIdentityHash: source.providerEffectIdentityHash ?? null }) : null;
};
const failedPostcondition = (observation: ProofObservation | undefined, mutation: "no" | "dispatched" | "confirmed"): "pending" | "failed" => {
  if (observation?.browserFact) return observation.browserFact.browserOutcome === "DISPATCHED" ? "pending" : "failed";
  return mutation === "dispatched" ? "pending" : "failed";
};
const reasoningResult = (child: GptChildCapabilityId, observation: GptChildObservation): GptReasoningRequirementResult | null => {
  if (child !== "select_gpt_reasoning_from_start_v3") return null;
  const value = observation.value as GptChildOutputMap["select_gpt_reasoning_from_start_v3"];
  return Object.freeze({ requestedValue: value.requestedValue, observedScale: Object.freeze({ ...value.observedScale }),
    resolvedValue: value.resolvedValue, currentValue: value.currentValue, mutationOutcome: value.mutationOutcome,
    browserOutcome: value.browserOutcome, gptPostcondition: value.gptPostcondition });
};
export const failedGptChildExecutionResult = async <K extends GptChildCapabilityId>(input: Readonly<{
  intent: GptChildCapabilityIntent<K>; context: GptExecutionContext; startedAt: string; observation?: GptChildObservation<K>; error: unknown;
}>): Promise<GptChildCapabilityResult<K>> => {
  const error = errorFacts(input.error, input.observation);
  const persisted = projectBrowserFact(input.intent, input.context)?.fact ?? null, rateLimit = rateLimitFact(input.intent, input.error, error.code);
  const fact = persisted && rateLimit?.knownGptRateLimitPreflightFact
    ? Object.freeze({ ...persisted, knownGptRateLimitPreflightFact: rateLimit.knownGptRateLimitPreflightFact }) : persisted ?? rateLimit;
  const observation = failureObservation(error.source, fact, error.nativeCause?.code ?? null);
  const committedMutation = observation?.mutationOutcome ?? ((input.context.browser?.pendingMutationCount() ?? 0) > 0 ? "dispatched" : error.mutationOutcome);
  const proof = proofFor({ intent: input.intent, startedAt: input.startedAt, ...(observation ? { observation } : {}), code: error.code,
    nativeFailureCode: error.nativeCause?.code ?? null, committedMutation, postconditionResult: failedPostcondition(observation, committedMutation) });
  await input.context.onProof?.(proof);
  const result = { status: "failed" as const, value: null, proof, failureCode: error.code, failureCause: error.nativeCause,
    exactReadbackNegativeObservation: executionFailureMetadata(input.error)?.exactReadbackNegativeObservation,
    failureBrowserEffect: failureEffect(observation?.browserFact, error.browserEffect), reasoningRequirementResult: error.reasoningRequirementResult };
  const causeEventId = runtimeLogCauseEventId(input.error);
  if (causeEventId) withRuntimeLogCauseFact(result, causeEventId);
  return Object.freeze(result) as GptChildCapabilityResult<K>;
};
const assertExecutionIdentity = (intent: GptChildCapabilityIntent): void => {
  if ([intent.executionId, intent.jobId, intent.attemptId, intent.productStepId, intent.callId].some(value => !value)
    || !Number.isSafeInteger(intent.resultRevision) || intent.resultRevision < 0
    || !Number.isSafeInteger(intent.actionOrdinal) || intent.actionOrdinal < 1 || !/^sha256:[a-f0-9]{64}$/u.test(intent.inputHash)) {
    throw executionFailure("failed", "GPT_CHILD_EXECUTION_IDENTITY_INVALID");
  }
};
const assertObservationAtomic = (context: GptExecutionContext, observation: GptChildObservation, child: GptChildCapabilityId): void => {
  if (child !== "checkpoint_gpt_generated_image" && observation.observationRevisionHash === null) {
    throw executionFailure("failed", `GPT_OBSERVATION_REVISION_REQUIRED:${child}`);
  }
  const pending = context.browser?.pendingMutationCount() ?? 0;
  if (observation.mutationOutcome === "confirmed" && pending > 1) throw executionFailure("failed", `GPT_MUTATION_OUTCOME_NOT_UNIQUE:${child}`);
  if (observation.mutationOutcome === "dispatched" || observation.mutationOutcome === "no" && pending !== 0) throw executionFailure("failed", `GPT_UNDECLARED_MUTATION:${child}`);
};
const executeOne = async <K extends GptChildCapabilityId>(intent: GptChildCapabilityIntent<K>, context: GptExecutionContext): Promise<GptChildCapabilityResult<K>> => {
  const startedAt = new Date().toISOString(), registered: unknown = Reflect.get(gptChildHandlers, intent.childCapabilityId);
  if (typeof registered !== "function") throw executionFailure("failed", `GPT_CHILD_NOT_REGISTERED:${intent.childCapabilityId}`);
  let observation: GptChildObservation<K> | undefined;
  try {
    assertExecutionIdentity(intent);
    if (context.signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    if ((context.browser?.pendingMutationCount() ?? 0) !== 0) throw executionFailure("failed", "GPT_PRIOR_BROWSER_MUTATION_UNRESOLVED");
    observation = await (registered as GptChildHandler<K>)(intent, context);
    assertObservationAtomic(context, observation, intent.childCapabilityId);
    const proof = proofFor({ intent, startedAt, observation });
    await context.onProof?.(proof);
    return Object.freeze({ status: "success", value: observation.value, proof, failureCode: null, failureCause: null,
      failureBrowserEffect: null, reasoningRequirementResult: reasoningResult(intent.childCapabilityId, observation) }) as GptChildCapabilityResult<K>;
  } catch (error) {
    if (failureCode(error) === "BROWSER_GPT_DIALOG_UNRECOGNIZED") throw error;
    return await failedGptChildExecutionResult({ intent, context, startedAt, ...(observation ? { observation } : {}), error });
  }
};
export const createGptAbilityGroup = (): GptAbilityGroup => Object.freeze({ execute: executeOne });
