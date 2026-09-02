import { createHash } from "node:crypto";
import {
  executionFailure,
  failureCode,
  serializeTerminalFailure,
  typedExecutionFailure,
} from "../../lib/typed-failure.js";

import {
  GPT_ABILITY_GROUP_ID,
  GPT_CHILD_CAPABILITY_CONTRACTS,
  GPT_CHILD_CAPABILITY_IDS,
  GPT_TRANSPORT,
  gptExactCallIdentityHash,
  type GptAbilityGroup,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
  type GptExecutionContext,
  type GptFailureClassification,
} from "./contract.js";
import { sessionChildHandlers } from "./session/session-children.js";
import type { GptChildHandler, GptChildObservation } from "./web/child-handler.js";
import { attachmentChildHandlers } from "./web/children/attachment-children.js";
import { composerSubmissionChildHandlers } from "./web/children/composer-submission-children.js";
import { conversationChildHandlers } from "./web/children/conversation-children.js";
import { executionProfileChildHandlers } from "./web/children/execution-profile-children.js";
import { modelSelectionV2ChildHandlers } from "./web/children/model-selection-v2-children.js";
import { responseChildHandlers } from "./web/children/response-children.js";

const handlers = Object.freeze({
  ...conversationChildHandlers,
  ...executionProfileChildHandlers,
  ...modelSelectionV2ChildHandlers,
  ...attachmentChildHandlers,
  ...composerSubmissionChildHandlers,
  ...responseChildHandlers,
  ...sessionChildHandlers,
} satisfies { readonly [K in GptChildCapabilityId]: GptChildHandler<K> });

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const classify = (error: unknown): Readonly<{
  status: GptFailureClassification;
  code: string;
}> => Object.freeze({
  status: "failed",
  code: failureCode(error, "GPT_CHILD_UNCLASSIFIED_FAILURE"),
});

const documentRefHash = (value: string | null): `sha256:${string}` | null =>
  value === null ? null : hash(value);

type ProofInput<K extends GptChildCapabilityId> = Readonly<{
  intent: GptChildCapabilityIntent<K>;
  context: GptExecutionContext;
  startedAt: string;
  endedAt: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeDocumentRef: string | null;
  afterDocumentRef: string | null;
  observation?: GptChildObservation<K>;
  failureCode?: string;
  nativeFailureCode?: string | null;
  committedMutation?: "no" | "dispatched" | "confirmed";
  postconditionResult?: "passed" | "failed" | "pending";
}>;

const proofAuthorities = <K extends GptChildCapabilityId>(input: ProofInput<K>) => {
  const targetRefHash = input.context.browser ? hash(input.context.browser.target.targetRef) : null;
  const beforeDocumentRefHash = documentRefHash(input.beforeDocumentRef);
  const afterDocumentRefHash = documentRefHash(input.afterDocumentRef);
  const authorityRefHashes = Object.freeze(
    [targetRefHash, beforeDocumentRefHash, afterDocumentRefHash, ...(input.observation?.authorityRefHashes ?? [])]
      .filter((value, index, values): value is `sha256:${string}` =>
        value !== null && values.indexOf(value) === index),
  );
  return Object.freeze({ targetRefHash, beforeDocumentRefHash, afterDocumentRefHash, authorityRefHashes });
};

const proofFor = <K extends GptChildCapabilityId>(input: ProofInput<K>): GptChildCapabilityProof => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId];
  const childStatus = input.failureCode ? "failed" as const : "success" as const;
  const committedMutation = input.committedMutation ?? input.observation?.mutationOutcome ?? "no" as const;
  const postconditionResult = input.postconditionResult ?? input.observation?.postconditionResult ?? "failed" as const;
  const { targetRefHash, beforeDocumentRefHash, afterDocumentRefHash, authorityRefHashes } = proofAuthorities(input);
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
    targetRefHash,
    beforeDocumentRefHash,
    afterDocumentRefHash,
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

const currentDocument = (context: GptExecutionContext): Readonly<{
  ref: string | null;
  url: string | null;
}> => context.browser
  ? Object.freeze({ ref: context.browser.document.documentRef, url: null })
  : Object.freeze({ ref: null, url: null });

const documentTransitionAllowed = (
  childCapabilityId: GptChildCapabilityId,
  before: Readonly<{ ref: string | null; url: string | null }>,
  after: Readonly<{ ref: string | null; url: string | null }>,
): boolean => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[childCapabilityId];
  if (contract.allowedDocumentTransition === "not-applicable") return before.ref === null && after.ref === null;
  if (contract.allowedDocumentTransition === "forbidden") return before.ref === after.ref;
  return before.ref !== null && after.ref !== null;
};

const assertObservationIsAtomic = (
  intent: Readonly<{ childCapabilityId: GptChildCapabilityId }>,
  context: GptExecutionContext,
  before: Readonly<{ ref: string | null; url: string | null }>,
  observation: GptChildObservation,
): void => {
  if (!documentTransitionAllowed(intent.childCapabilityId, before, currentDocument(context))) {
    throw executionFailure("failed", `GPT_DOCUMENT_TRANSITION_FORBIDDEN:${intent.childCapabilityId}`);
  }
  const pendingMutationCount = context.browser?.pendingMutationCount() ?? 0;
  if (observation.mutationOutcome === "confirmed" && pendingMutationCount > 1) {
    throw executionFailure("failed", `GPT_MUTATION_OUTCOME_NOT_UNIQUE:${intent.childCapabilityId}`);
  }
  if (observation.mutationOutcome === "no" && pendingMutationCount !== 0) {
    if (context.mutationMode !== "readback" || pendingMutationCount !== 1) {
      throw executionFailure("failed", `GPT_UNDECLARED_MUTATION:${intent.childCapabilityId}`);
    }
  }
};

const successfulExecution = async <K extends GptChildCapabilityId>(input: Readonly<{
  intent: GptChildCapabilityIntent<K>;
  context: GptExecutionContext;
  startedAt: string;
  before: Readonly<{ ref: string | null; url: string | null }>;
  observation: GptChildObservation<K>;
}>): Promise<GptChildCapabilityResult<K>> => {
  const after = currentDocument(input.context);
  const proof = proofFor({
    intent: input.intent, context: input.context, startedAt: input.startedAt, endedAt: new Date().toISOString(),
    beforeUrl: input.before.url, afterUrl: after.url,
    beforeDocumentRef: input.before.ref, afterDocumentRef: after.ref,
    observation: input.observation,
  });
  await input.context.onProof?.(proof);
  return Object.freeze({
    status: "success", value: input.observation.value, proof, failureCode: null, failureCause: null,
    failureBrowserEffect: null,
  }) as GptChildCapabilityResult<K>;
};

const failedExecution = async <K extends GptChildCapabilityId>(input: Readonly<{
  intent: GptChildCapabilityIntent<K>;
  context: GptExecutionContext;
  startedAt: string;
  before: Readonly<{ ref: string | null; url: string | null }>;
  observation?: GptChildObservation<K>;
  error: unknown;
}>): Promise<GptChildCapabilityResult<K>> => {
  const after = currentDocument(input.context);
  const failure = classify(input.error);
  const serialized = serializeTerminalFailure(input.error);
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId];
  const browserFailureOutcome = typedExecutionFailure(input.error)?.mutationOutcome ?? "no";
  const browserDispatched = (input.context.browser?.pendingMutationCount() ?? 0) > 0 && !input.observation;
  const sessionDispatched = !input.observation && contract?.requiredTargetKind === "none"
    && contract.oneObservationOrMutation === "at-most-one-mutation"
    && !failure.code.startsWith("GPT_CHILD_INPUT_INVALID:");
  const committedMutation = input.observation?.mutationOutcome
    ?? (browserFailureOutcome !== "no" ? browserFailureOutcome
      : browserDispatched || sessionDispatched ? "dispatched" : "no");
  const proof = proofFor({
    intent: input.intent, context: input.context, startedAt: input.startedAt, endedAt: new Date().toISOString(),
    beforeUrl: input.before.url, afterUrl: after.url,
    beforeDocumentRef: input.before.ref, afterDocumentRef: after.ref,
    ...(input.observation ? { observation: input.observation } : {}), failureCode: failure.code,
    nativeFailureCode: serialized.cause?.code ?? null, committedMutation,
    postconditionResult: committedMutation === "dispatched" ? "pending" : "failed",
  });
  await input.context.onProof?.(proof);
  return Object.freeze({
    status: failure.status, value: null, proof, failureCode: failure.code,
    failureCause: serialized.cause,
    failureBrowserEffect: serialized.browser_outcome === null ? null : Object.freeze({
      effectScope: serialized.effect_scope!,
      childCapabilityId: serialized.child_capability_id!,
      browserOutcome: serialized.browser_outcome,
    }),
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
  const handler = handlers[intent.childCapabilityId] as GptChildHandler<K>;
  const before = currentDocument(context);
  let observation: GptChildObservation<K> | undefined;
  try {
    assertExecutionIdentity(intent);
    if (!handler) throw executionFailure("failed", `GPT_CHILD_NOT_REGISTERED:${intent.childCapabilityId}`);
    if (context.signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    if ((context.browser?.pendingMutationCount() ?? 0) !== 0 && context.mutationMode !== "readback") {
      throw executionFailure("failed", "GPT_PRIOR_BROWSER_MUTATION_UNRESOLVED");
    }
    const nextObservation = await handler(intent, context);
    observation = nextObservation;
    assertObservationIsAtomic(intent, context, before, nextObservation);
    return await successfulExecution({ intent, context, startedAt, before, observation: nextObservation });
  } catch (error) {
    return await failedExecution({ intent, context, startedAt, before, ...(observation ? { observation } : {}), error });
  }
};

export { GPT_CHILD_CAPABILITY_CONTRACTS, gptExactCallIdentityHash } from "./contract.js";

export const createGptAbilityGroup = (): GptAbilityGroup => Object.freeze({
  abilityGroupId: GPT_ABILITY_GROUP_ID,
  transport: GPT_TRANSPORT,
  listChildCapabilityIds: () => GPT_CHILD_CAPABILITY_IDS,
  execute: executeOne,
});
