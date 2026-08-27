import { createHash } from "node:crypto";

import {
  GPT_ABILITY_GROUP_ID,
  GPT_CHILD_CAPABILITY_CONTRACTS,
  GPT_CHILD_CAPABILITY_IDS,
  GPT_TRANSPORT,
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
import { responseChildHandlers } from "./web/children/response-children.js";
import { targetDocumentChildHandlers } from "./web/children/target-document-children.js";
import { titleChildHandlers } from "./web/children/title-children.js";
import { transientUiChildHandlers } from "./web/children/transient-ui-children.js";

const handlers = Object.freeze({
  ...targetDocumentChildHandlers,
  ...transientUiChildHandlers,
  ...conversationChildHandlers,
  ...executionProfileChildHandlers,
  ...attachmentChildHandlers,
  ...composerSubmissionChildHandlers,
  ...responseChildHandlers,
  ...titleChildHandlers,
  ...sessionChildHandlers,
} satisfies Record<GptChildCapabilityId, GptChildHandler>);

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const classify = (error: unknown): Readonly<{
  status: GptFailureClassification;
  code: string;
}> => {
  const message = error instanceof Error ? error.message : "GPT_CHILD_UNKNOWN_FAILURE";
  const match = /^(recovery_pending|review_required|failed):(.*)$/u.exec(message);
  return Object.freeze({
    status: (match?.[1] ?? "failed") as GptFailureClassification,
    code: match?.[2] ?? message,
  });
};

const documentRefHash = (value: string | null): `sha256:${string}` | null =>
  value === null ? null : hash(value);

const proofFor = (input: Readonly<{
  intent: GptChildCapabilityIntent;
  context: GptExecutionContext;
  startedAt: string;
  endedAt: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeDocumentRef: string | null;
  afterDocumentRef: string | null;
  observation?: GptChildObservation;
  failureCode?: string;
  committedMutation?: "no" | "yes" | "unknown";
  postconditionResult?: "passed" | "failed" | "unknown";
}>): GptChildCapabilityProof => {
  const unsigned = {
    schemaVersion: "gpt-child-capability-proof.v1" as const,
    childCapabilityId: input.intent.childCapabilityId,
    executionId: input.intent.executionId,
    targetRefHash: input.context.browser ? hash(input.context.browser.target.targetRef) : null,
    beforeDocumentRefHash: documentRefHash(input.beforeDocumentRef),
    afterDocumentRefHash: documentRefHash(input.afterDocumentRef),
    beforeUrl: input.beforeUrl,
    afterUrl: input.afterUrl,
    candidateCount: input.observation?.candidateCount ?? null,
    observedSemantics: input.observation?.observedSemantics
      ?? Object.freeze([`failure:${input.failureCode ?? "GPT_CHILD_FAILED"}`]),
    committedMutation: input.committedMutation ?? input.observation?.committedMutation ?? "no" as const,
    postconditionResult: input.postconditionResult ?? input.observation?.postconditionResult ?? "failed" as const,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
  const evidenceHash = hash(JSON.stringify(unsigned));
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

const executeOne = async (
  intent: GptChildCapabilityIntent,
  context: GptExecutionContext,
): Promise<GptChildCapabilityResult> => {
  const startedAt = new Date().toISOString();
  const handler = handlers[intent.childCapabilityId];
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId];
  const before = currentDocument(context);
  let observation: GptChildObservation | undefined;
  try {
    if (!handler || !contract) throw new Error(`failed:GPT_CHILD_NOT_REGISTERED:${intent.childCapabilityId}`);
    if (context.signal?.aborted) throw new Error("recovery_pending:GPT_EXECUTION_ABORTED");
    if ((context.browser?.pendingMutationCount() ?? 0) !== 0) {
      throw new Error("review_required:GPT_PRIOR_BROWSER_MUTATION_UNRESOLVED");
    }
    observation = await handler(intent, context);
    const after = currentDocument(context);
    if (!documentTransitionAllowed(intent.childCapabilityId, before, after)) {
      throw new Error(`review_required:GPT_DOCUMENT_TRANSITION_FORBIDDEN:${intent.childCapabilityId}`);
    }
    if (observation.committedMutation === "yes" && (context.browser?.pendingMutationCount() ?? 0) > 1) {
      throw new Error(`review_required:GPT_MUTATION_OUTCOME_NOT_UNIQUE:${intent.childCapabilityId}`);
    }
    if (observation.committedMutation === "no" && context.browser?.pendingMutationCount() !== 0) {
      throw new Error(`review_required:GPT_UNDECLARED_MUTATION:${intent.childCapabilityId}`);
    }
    const proof = proofFor({
      intent, context, startedAt, endedAt: new Date().toISOString(),
      beforeUrl: before.url, afterUrl: after.url,
      beforeDocumentRef: before.ref, afterDocumentRef: after.ref,
      ...(observation ? { observation } : {}),
    });
    await context.onProof?.(proof);
    return Object.freeze({ status: "success", value: observation.value, proof, failureCode: null });
  } catch (error) {
    const after = currentDocument(context);
    const failure = classify(error);
    const browserMutationUnknown = (context.browser?.pendingMutationCount() ?? 0) > 0 && !observation;
    const sessionMutationUnknown = !observation && contract?.requiredTargetKind === "none"
      && contract.oneObservationOrMutation === "at-most-one-mutation";
    const committedMutation = observation?.committedMutation
      ?? (browserMutationUnknown || sessionMutationUnknown ? "unknown" : "no");
    const proof = proofFor({
      intent, context, startedAt, endedAt: new Date().toISOString(),
      beforeUrl: before.url, afterUrl: after.url,
      beforeDocumentRef: before.ref, afterDocumentRef: after.ref,
      ...(observation ? { observation } : {}),
      failureCode: failure.code,
      committedMutation,
      postconditionResult: committedMutation === "unknown" ? "unknown" : "failed",
    });
    await context.onProof?.(proof);
    return Object.freeze({
      status: committedMutation === "unknown" ? "review_required" : failure.status,
      value: null,
      proof,
      failureCode: failure.code,
    });
  }
};

export const createGptAbilityGroup = (): GptAbilityGroup => Object.freeze({
  abilityGroupId: GPT_ABILITY_GROUP_ID,
  transport: GPT_TRANSPORT,
  listChildCapabilityIds: () => GPT_CHILD_CAPABILITY_IDS,
  execute: executeOne,
});
