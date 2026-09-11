import { createHash } from "node:crypto";
import {
  executionFailureCause,
  executionFailure,
  failureCode,
} from "../../lib/execution-failure.js";
import { typedBrowserExecutionFailure } from "../../lib/browser/browser-authority-api.js";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptExactCallIdentityHash,
  type GptAbilityGroup,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
  type GptChildBrowserFact,
  type GptChildOutputMap,
  type GptExecutionContext,
  type GptFailureClassification,
  type GptReasoningRequirementResult,
} from "./contract.js";
import type { GptChildHandler, GptChildObservation } from "./web/child-handler.js";
import { gptChildHandlers } from "./handler-registry.js";
import { ProductionGptChildTools } from "./production-child-tools.js";
import {
  typedGptExecutionFailure,
  type GptFailureProofFacts,
} from "./execution-fault.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const classify = (error: unknown): Readonly<{
  status: GptFailureClassification;
  code: string;
}> => Object.freeze({
  status: "failed",
  code: failureCode(error, "GPT_CHILD_UNCLASSIFIED_FAILURE"),
});

type ProofObservation = GptFailureProofFacts & Readonly<{ postconditionResult?: "passed" }>;

type ProofInput<K extends GptChildCapabilityId> = Readonly<{
  intent: GptChildCapabilityIntent<K>;
  context: GptExecutionContext;
  startedAt: string;
  endedAt: string;
  observation?: ProofObservation;
  failureCode?: string;
  nativeFailureCode?: string | null;
  committedMutation?: "no" | "dispatched" | "confirmed";
  postconditionResult?: "passed" | "failed" | "pending";
}>;

const proofAuthorities = <K extends GptChildCapabilityId>(input: ProofInput<K>) => {
  const authorityRefHashes = Object.freeze(
    [...(input.observation?.authorityRefHashes ?? [])]
      .filter((value, index, values) => values.indexOf(value) === index),
  );
  return Object.freeze({ authorityRefHashes });
};

const proofFor = <K extends GptChildCapabilityId>(input: ProofInput<K>): GptChildCapabilityProof => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId];
  const childStatus = input.failureCode ? "failed" as const : "success" as const;
  const committedMutation = input.committedMutation ?? input.observation?.mutationOutcome ?? "no" as const;
  const postconditionResult = input.postconditionResult ?? input.observation?.postconditionResult ?? "failed" as const;
  const { authorityRefHashes } = proofAuthorities(input);
  const candidateCardinality = input.observation?.candidateCardinality
    ?? Object.freeze({ raw: null, eligible: null });
  const unsigned = {
    schemaVersion: "gpt-child-capability-proof.v2" as const,
    childCapabilityId: input.intent.childCapabilityId,
    childContractVersion: contract.contractVersion,
    childStatus,
    childReasonCode: input.failureCode ?? "GPT_CHILD_SUCCESS",
    exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
    internalDecisionCode: childStatus === "failed" ? "FAIL_CLOSED" as const
      : input.observation!.decision,
    executionId: input.intent.executionId,
    jobId: input.intent.jobId,
    attemptId: input.intent.attemptId,
    pluginId: input.intent.pluginId,
    pluginVersion: input.intent.pluginVersion,
    productStepId: input.intent.productStepId,
    callId: input.intent.callId,
    inputHash: input.intent.inputHash,
    actionOrdinal: input.intent.actionOrdinal,
    authorityRefHashes,
    factResultIds: input.observation?.factResultIds ?? Object.freeze([
      `gpt-fact-result:${hash(JSON.stringify({
        childCapabilityId: input.intent.childCapabilityId,
        failureCode: input.failureCode ?? null,
        nativeFailureCode: input.nativeFailureCode ?? null,
      })).slice(7)}`,
    ]),
    candidateCardinality,
    observationRevisionHash: input.observation?.observationRevisionHash ?? null,
    committedMutation,
    postconditionResult,
    browserFact: input.observation?.browserFact ?? null,
    nativeFailureCode: input.nativeFailureCode ?? input.observation?.nativeFailureCode ?? null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
  const evidenceHash = hash(JSON.stringify({
    ...unsigned,
    startedAt: null,
    endedAt: null,
  }));
  return Object.freeze({
    ...unsigned,
    evidenceRef: `gpt-child-proof:${input.intent.executionId}:${evidenceHash.slice(7, 23)}`,
    evidenceHash,
  });
};

const failedBrowserFact = <K extends GptChildCapabilityId>(
  intent: GptChildCapabilityIntent<K>,
  context: GptExecutionContext,
): GptChildBrowserFact | null => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId];
  if (!context.browser || contract.replayPolicy === "observation-only"
    || contract.replayPolicy === "transaction-identical-readback") return null;
  const recovery = context.browserAtomicIdentity
    ? context.browser.readAtomicStepOutcome(context.browserAtomicIdentity) : null;
  if (!recovery) return null;
  const legalPair = recovery.state === "dispatched"
    ? recovery.mutationOutcome === "dispatched"
    : recovery.state === "confirmed"
      ? recovery.mutationOutcome === "no" || recovery.mutationOutcome === "confirmed"
      : recovery.mutationOutcome === "no" || recovery.mutationOutcome === "confirmed"
        || recovery.mutationOutcome === "dispatched";
  if (!legalPair) return null;
  const browserOutcome = recovery.state === "confirmed" ? "CONFIRMED" as const
    : recovery.state === "rejected" ? "REJECTED" as const : "DISPATCHED" as const;
  return Object.freeze({
    exactCallIdentityHash: gptExactCallIdentityHash(intent),
    childCapabilityId: intent.childCapabilityId,
    effectScope: contract.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
    browserOutcome,
    mutationOutcome: recovery.mutationOutcome,
    terminalAt: recovery.terminalAt,
    evidenceRef: recovery.authorityRef,
    evidenceHash: recovery.authorityHash,
  });
};

const assertObservationIsAtomic = (
  intent: Readonly<{ childCapabilityId: GptChildCapabilityId }>,
  context: GptExecutionContext,
  observation: GptChildObservation,
): void => {
  const pendingMutationCount = context.browser?.pendingMutationCount() ?? 0;
  if (observation.mutationOutcome === "confirmed" && pendingMutationCount > 1) {
    throw executionFailure("failed", `GPT_MUTATION_OUTCOME_NOT_UNIQUE:${intent.childCapabilityId}`);
  }
  if (observation.mutationOutcome === "dispatched") {
    throw executionFailure("failed", `GPT_UNDECLARED_MUTATION:${intent.childCapabilityId}`);
  }
  if (observation.mutationOutcome === "no" && pendingMutationCount !== 0) {
    throw executionFailure("failed", `GPT_UNDECLARED_MUTATION:${intent.childCapabilityId}`);
  }
};

const successfulReasoningRequirementResult = (
  childCapabilityId: GptChildCapabilityId,
  observation: GptChildObservation,
): GptReasoningRequirementResult | null => {
  if (childCapabilityId !== "ensure_gpt_reasoning_requirement") return null;
  const value = observation.value as GptChildOutputMap["ensure_gpt_reasoning_requirement"];
  return Object.freeze({
    requestedTier: value.requestedTier,
    requestedValue: value.requestedValue,
    selectionPolicy: value.selectionPolicy,
    observedScale: Object.freeze({ ...value.observedScale }),
    resolvedTier: value.resolvedTier,
    resolvedValue: value.resolvedValue,
    degraded: value.degraded,
    currentValue: value.currentValue,
    mutationOutcome: value.mutationOutcome,
    browserOutcome: value.browserOutcome,
    gptPostcondition: value.gptPostcondition,
  });
};

const successfulExecution = async <K extends GptChildCapabilityId>(input: Readonly<{
  intent: GptChildCapabilityIntent<K>;
  context: GptExecutionContext;
  startedAt: string;
  observation: GptChildObservation<K>;
}>): Promise<GptChildCapabilityResult<K>> => {
  const proof = proofFor({
    intent: input.intent, context: input.context, startedAt: input.startedAt, endedAt: new Date().toISOString(),
    observation: input.observation,
  });
  await input.context.onProof?.(proof);
  return Object.freeze({
    status: "success", value: input.observation.value, proof, failureCode: null, failureCause: null,
    failureBrowserEffect: null,
    reasoningRequirementResult: successfulReasoningRequirementResult(
      input.intent.childCapabilityId,
      input.observation,
    ),
  }) as GptChildCapabilityResult<K>;
};

const failureObservation = <K extends GptChildCapabilityId>(input: Readonly<{
  observation?: GptChildObservation<K>;
  gptProof?: GptFailureProofFacts;
  walBrowserFact: GptChildBrowserFact | null;
  nativeFailureCode: string | null;
}>): ProofObservation | undefined => {
  if (input.observation) return input.observation;
  if (input.gptProof) {
    const browserFact = input.gptProof.browserFact ?? input.walBrowserFact;
    return Object.freeze({
      ...input.gptProof,
      factResultIds: Object.freeze([
        ...input.gptProof.factResultIds,
        ...(browserFact && !input.gptProof.factResultIds.includes(browserFact.evidenceRef)
          ? [browserFact.evidenceRef] : []),
      ]),
      authorityRefHashes: Object.freeze([
        ...input.gptProof.authorityRefHashes,
        ...(browserFact && !input.gptProof.authorityRefHashes.includes(browserFact.evidenceHash)
          ? [browserFact.evidenceHash] : []),
      ]),
      mutationOutcome: browserFact?.mutationOutcome ?? input.gptProof.mutationOutcome,
      browserFact,
    });
  }
  if (!input.walBrowserFact) return undefined;
  return Object.freeze({
    decision: "FAIL_CLOSED" as const,
    factResultIds: Object.freeze([input.walBrowserFact.evidenceRef]),
    candidateCardinality: Object.freeze({ raw: null, eligible: null }),
    authorityRefHashes: Object.freeze([input.walBrowserFact.evidenceHash]),
    observationRevisionHash: null,
    mutationOutcome: input.walBrowserFact.mutationOutcome,
    browserFact: input.walBrowserFact,
    nativeFailureCode: input.nativeFailureCode,
  });
};

const committedMutationFor = (
  observation: ProofObservation | undefined,
  browserFailureOutcome: "no" | "dispatched" | "confirmed",
  dispatchedWithoutObservation: boolean,
): "no" | "dispatched" | "confirmed" => {
  if (observation) return observation.mutationOutcome;
  if (browserFailureOutcome !== "no") return browserFailureOutcome;
  return dispatchedWithoutObservation ? "dispatched" : "no";
};

const failureEffect = <K extends GptChildCapabilityId>(
  observation: ProofObservation | undefined,
  fallback: GptChildCapabilityResult<K>["failureBrowserEffect"],
): GptChildCapabilityResult<K>["failureBrowserEffect"] => {
  const source = observation?.browserFact ?? fallback;
  return source ? Object.freeze({
    effectScope: source.effectScope,
    childCapabilityId: source.childCapabilityId,
    browserOutcome: source.browserOutcome,
  }) : null;
};

const browserMutationWasDispatched = (
  context: GptExecutionContext,
  observation: GptChildObservation<GptChildCapabilityId> | undefined,
): boolean => (context.browser?.pendingMutationCount() ?? 0) > 0 && !observation;

const sessionMutationWasDispatched = (
  intent: GptChildCapabilityIntent<GptChildCapabilityId>,
  observation: GptChildObservation<GptChildCapabilityId> | undefined,
  failureCode: string,
): boolean => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId];
  return !observation && contract?.requiredTargetKind === "none"
    && contract.oneObservationOrMutation === "at-most-one-mutation"
    && !failureCode.startsWith("GPT_CHILD_INPUT_INVALID:");
};

const failurePostconditionResult = (
  _intent: GptChildCapabilityIntent,
  _context: GptExecutionContext,
  observation: ProofObservation | undefined,
  committedMutation: "no" | "dispatched" | "confirmed",
  _failureCode: string,
): "pending" | "failed" => {
  if (observation?.browserFact) {
    return observation.browserFact.browserOutcome === "DISPATCHED" ? "pending" : "failed";
  }
  return committedMutation === "dispatched" ? "pending" : "failed";
};

const failedExecution = async <K extends GptChildCapabilityId>(input: Readonly<{
  intent: GptChildCapabilityIntent<K>;
  context: GptExecutionContext;
  startedAt: string;
  observation?: GptChildObservation<K>;
  error: unknown;
}>): Promise<GptChildCapabilityResult<K>> => {
  const browser = typedBrowserExecutionFailure(input.error);
  const failureError = input.error;
  const failure = classify(failureError);
  const nativeCause = executionFailureCause(failureError);
  const gpt = typedGptExecutionFailure(input.error);
  const walBrowserFact = failedBrowserFact(input.intent, input.context);
  const observation = failureObservation({
    ...(input.observation ? { observation: input.observation } : {}),
    ...(gpt?.proofFacts ? { gptProof: gpt.proofFacts } : {}),
    walBrowserFact,
    nativeFailureCode: nativeCause?.code ?? null,
  });
  const browserFailureOutcome = browser?.mutationOutcome ?? gpt?.mutationOutcome ?? "no";
  const committedMutation = committedMutationFor(
    observation,
    browserFailureOutcome,
    browserMutationWasDispatched(input.context, input.observation)
      || sessionMutationWasDispatched(input.intent, input.observation, failure.code),
  );
  const postconditionResult = failurePostconditionResult(
    input.intent, input.context, observation, committedMutation, failure.code,
  );
  const proof = proofFor({
    intent: input.intent, context: input.context, startedAt: input.startedAt, endedAt: new Date().toISOString(),
    ...(observation ? { observation } : {}), failureCode: failure.code,
    nativeFailureCode: nativeCause?.code ?? null, committedMutation,
    postconditionResult,
  });
  await input.context.onProof?.(proof);
  const browserEffect = failureEffect<K>(observation, gpt?.browserEffect ?? browser?.browserEffect ?? null);
  return Object.freeze({
    status: failure.status, value: null, proof, failureCode: failure.code,
    failureCause: nativeCause,
    failureBrowserEffect: browserEffect,
    reasoningRequirementResult: gpt?.reasoningRequirementResult ?? null,
  }) as GptChildCapabilityResult<K>;
};

const assertExecutionIdentity = (intent: Readonly<{
  executionId: string;
  jobId: string;
  attemptId: string;
  pluginId: string;
  pluginVersion: number;
  productStepId: string;
  callId: string;
  inputHash: `sha256:${string}`;
  actionOrdinal: number;
}>): void => {
  if (!intent.executionId || !intent.jobId || !intent.attemptId || !intent.pluginId
    || !Number.isSafeInteger(intent.pluginVersion) || intent.pluginVersion < 1
    || !intent.productStepId || !intent.callId
    || !Number.isSafeInteger(intent.actionOrdinal) || intent.actionOrdinal < 1
    || !/^sha256:[a-f0-9]{64}$/u.test(intent.inputHash)) {
    throw executionFailure("failed", "GPT_CHILD_EXECUTION_IDENTITY_INVALID");
  }
};

const executeOne = async <K extends GptChildCapabilityId>(
  intent: GptChildCapabilityIntent<K>,
  context: GptExecutionContext,
): Promise<GptChildCapabilityResult<K>> => {
  const startedAt = new Date().toISOString();
  const registeredHandler: unknown = Reflect.get(gptChildHandlers, intent.childCapabilityId);
  if (typeof registeredHandler !== "function") {
    throw executionFailure("failed", `GPT_CHILD_NOT_REGISTERED:${intent.childCapabilityId}`);
  }
  const handler = registeredHandler as GptChildHandler<K>;
  let observation: GptChildObservation<K> | undefined;
  try {
    assertExecutionIdentity(intent);
    if (context.signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    if ((context.browser?.pendingMutationCount() ?? 0) !== 0) {
      throw executionFailure("failed", "GPT_PRIOR_BROWSER_MUTATION_UNRESOLVED");
    }
    const nextObservation = await handler(intent, context);
    observation = nextObservation;
    assertObservationIsAtomic(intent, context, nextObservation);
    return await successfulExecution({ intent, context, startedAt, observation: nextObservation });
  } catch (error) {
    return await failedExecution({
      intent, context, startedAt,
      ...(observation ? { observation } : {}), error,
    });
  }
};

export const createGptAbilityGroup = (): GptAbilityGroup => Object.freeze({
  execute: executeOne,
});

export const createProductionGptChildTools = (
  ...input: ConstructorParameters<typeof ProductionGptChildTools>
): ProductionGptChildTools => new ProductionGptChildTools(...input);
