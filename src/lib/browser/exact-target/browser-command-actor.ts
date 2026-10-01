import type { BrowserCommandPermit } from "../transport/command-permit.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { withRuntimeLogCause, type RuntimeLogger } from "../../runtime-logs/index.js";
import { executionFailure } from "../../execution-failure.js";
import type {
  BrowserDomIntent,
} from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import { bindExactAssistantTurnReply } from "./browser-exact-assistant-turn-reply.js";
import {
  awaitBrowserPostSubmitQuiet,
  assertBrowserCommandTerminalReplyMargin,
  bindBrowserCommandObservationPacket,
  browserExactCallIdentityHash,
  browserProviderEffectIdentityHash,
} from "./browser-command-postcondition.js";
import {
  completeBrowserCommandSpan,
  emitBrowserMutationEvent,
  failBrowserCommandSpan,
  startBrowserCommandSpan,
} from "./browser-command-runtime-logging.js";
import {
  failBrowserCommandExecution,
  hashBrowserCommandValue as hashValue,
  type AuthenticatedTerminalReplyFailure,
  type BrowserCommandExecutionState,
} from "./browser-command-failure.js";
import {
  BrowserMutationStore,
} from "./browser-mutation-store.js";
import type { BrowserAtomicStepOutcome, BrowserMutationIdentity } from "./browser-mutation-types.js";
import type { BrowserAtomicStepIdentity } from "./browser-target-lease.js";
import type { TransientDomConfirmationStage } from "./browser-target-lease.js";
import { browserMutationReceiptBindingProjection, type BrowserMutationTerminalFact } from "./browser-observation-receipt.js";
import {
  decodeKnownGptRateLimitPreflightReply,
  knownGptRateLimitPreflightFactValid,
  type BrowserPreflightReply,
} from "./browser-special-mutation-receipt.js";

export type BrowserGovernedCommand =
  | Readonly<{ kind: "dom-intent"; intent: BrowserDomIntent }>
  | Readonly<{ kind: "observe"; capabilityId: import("../protocol/generated/browser-protocol.generated.js").BrowserCapabilityId }>
  | Readonly<{ kind: "screenshot"; regionLabel: string }>
  | Readonly<{
    kind: "file-input";
    selector: string;
    activation: Readonly<{
      selector: string;
      scope: Readonly<{ selector: string }>;
      expectedText: string;
    }>;
    approvedFiles: readonly Readonly<{
      grantRef: string;
      contentHash: `sha256:${string}`;
      maxBytes: number;
    }>[];
    resolvedFilePaths: readonly string[];
  }>
  | Readonly<{
    kind: "authenticated-media";
    canonicalConversationUrl: string;
    userTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
  }>
  | Readonly<{ kind: "wait"; durationMs: number; transientDomConfirmationStage?: never }>
  | Readonly<{
    kind: "wait";
    transientDomConfirmationStage: TransientDomConfirmationStage;
    durationMs?: never;
  }>
  | Readonly<{ kind: "park-target"; reason: string }>;

export type BrowserCommandPort = Readonly<{
  send(
    permit: BrowserCommandPermit,
    command: BrowserGovernedCommand,
    onDispatched?: () => void,
    receiptBindingHash?: `sha256:${string}` | null,
  ): Promise<BrowserCommandReply>;
}>;

export type BrowserCommandReply = Readonly<{
  replyChannelToken: string;
  transportSequence: number;
  permitSequence: number;
  result: unknown;
  mutationReceipt: BrowserMutationTerminalFact | null;
}>;

/** An authenticated extension REPLY that explicitly terminalized the command as rejected. */
export class BrowserCommandTerminalReplyError extends Error {
  public constructor(
    public readonly failureCode: string,
    public readonly replyChannelToken: string,
    public readonly transportSequence: number,
    public readonly permitSequence: number,
  ) {
    super(failureCode);
    this.name = "BrowserCommandTerminalReplyError";
  }
}

export type BrowserCommandAuthorityGuard = Readonly<{
  assertCurrentAuthority(permit: BrowserCommandPermit): void;
}>;

const assertAcceptedCommand = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): void => {
  assertValidCommandPermit(permit);
  if (command.kind === "dom-intent") assertBrowserDomIntent(command.intent);
};

const isMutation = (command: BrowserGovernedCommand): boolean =>
  command.kind === "file-input"
  || (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "hover"
    || command.intent.kind === "doubleClick" || command.intent.kind === "keypress" || command.intent.kind === "fill"
    || command.intent.kind === "acknowledgeKnownGptRateLimit"));

const postconditionPair = (command: BrowserGovernedCommand): Readonly<{
  positive: `sha256:${string}`;
  negative: `sha256:${string}`;
}> => {
  if (!isMutation(command)) throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
  if (command.kind === "file-input") {
    const positive = {
      kind: "file-input",
      selector: command.selector,
      activation: command.activation,
      approvedFiles: command.approvedFiles,
      composerUploadObserved: true,
    };
    return Object.freeze({
      positive: hashValue({ ...positive, result: "passed" }),
      negative: hashValue({ ...positive, result: "failed" }),
    });
  }
  if (command.kind !== "dom-intent") throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
  const intent = command.intent;
  let positive: Readonly<Record<string, unknown>>;
  switch (intent.kind) {
    case "acknowledgeKnownGptRateLimit":
      positive = { kind: intent.kind, exactKnownDialog: true, acknowledged: true,
        targetRefHash: intent.targetRefHash, documentRefHash: intent.documentRefHash };
      break;
    case "fill":
      positive = { kind: "fill", selector: intent.selector, retainedValueHash: hashValue(intent.approvedText) };
      break;
    case "click":
      positive = { kind: "click", selector: intent.selector,
        ...(intent.requiredClickPointSelector === undefined ? {} : {
          requiredClickPointSelector: intent.requiredClickPointSelector,
        }),
        precondition: intent.preClickExactOutgoingTurn,
        postcondition: intent.postClickAttribute ?? intent.postClickMatch
          ?? intent.postClickObservation ?? intent.postClickUrl };
      break;
    case "hover":
      positive = { kind: "hover", selector: intent.selector, postcondition: intent.postHoverAttribute };
      break;
    case "doubleClick":
      positive = { kind: "doubleClick", selector: intent.selector, postcondition: intent.postDoubleClickMatch };
      break;
    case "keypress":
      positive = { kind: "keypress", selector: intent.selector, key: intent.key, repeat: intent.repeat ?? 1,
        postcondition: intent.postKeypressMatch };
      break;
    default:
      throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
  }
  return Object.freeze({
    positive: hashValue({ ...positive, result: "passed" }),
    negative: hashValue({ ...positive, result: "failed" }),
  });
};

const mutationIdentity = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): BrowserMutationIdentity => {
  const postconditions = postconditionPair(command);
  const effectScope = permit.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local";
  const callIdentityHash = browserExactCallIdentityHash(permit);
  const payloadHash = hashValue(command);
  return {
    commandId: permit.commandId,
    logicalMutationId: effectScope === "provider_effect"
      ? browserProviderEffectIdentityHash(permit, payloadHash)
      : hashValue([callIdentityHash, permit.targetRef]),
    exactCallIdentityHash: callIdentityHash,
    jobId: permit.jobId,
    resultRevision: permit.resultRevision,
    attemptId: permit.attemptId,
    leaseVersion: permit.leaseVersion,
    executionFenceHash: permit.writerFenceHash,
    deliveryPriorityReplayGrantHash: effectScope === "provider_effect"
      ? permit.deliveryPriorityReplayGrantHash : null,
    domainRejectionRevision: permit.domainRejectionRevision ?? false,
    deliveryPriorityReplayCall: effectScope === "provider_effect"
      ? permit.deliveryPriorityReplayCall ?? null : null,
    productStepId: permit.productStepId,
    callId: permit.callId,
    childCapabilityId: permit.childCapabilityId,
    effectScope,
    actionOrdinal: permit.actionOrdinal,
    targetRef: permit.targetRef,
    documentRef: permit.documentRef,
    actionId: permit.capabilityId,
    positivePostconditionHash: postconditions.positive,
    negativePostconditionHash: postconditions.negative,
    requestHash: permit.inputHash,
    payloadHash,
  };
};

const gptDialogPreflightFailure = (
  value: unknown,
  failureCode: Exclude<BrowserPreflightReply["specialFailureCode"], null>,
): Error => {
  const fact = (value as Record<string, unknown>).knownGptRateLimitPreflightFact;
  if (!knownGptRateLimitPreflightFactValid(fact)) {
    return new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const hashes = [fact.exactCallIdentityHash, fact.targetRefHash,
    fact.documentRefHash, fact.observationHash];
  if (typeof fact.observedAt !== "string"
    || hashes.some((hash) => typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash))) {
    return new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return executionFailure("failed", failureCode, { metadata: {
    mutationOutcome: "no",
    knownGptRateLimitPreflightFact: fact,
    evidence: {
      evidenceRef: [failureCode === "BROWSER_KNOWN_GPT_RATE_LIMIT"
        ? "browser-known-gpt-rate-limit" : "browser-gpt-dialog-unrecognized",
      fact.observedAt, fact.exactCallIdentityHash, fact.targetRefHash, fact.documentRefHash].join("|"),
      evidenceHash: fact.observationHash as `sha256:${string}`,
    },
  } });
};

const assertMatchingReply = (permit: BrowserCommandPermit, reply: BrowserCommandReply): void => {
  if (reply.replyChannelToken !== permit.replyChannelToken || reply.permitSequence !== permit.sequence) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

export class BrowserCommandActor {

  public constructor(
    private readonly budget: BrowserCommandAdmissionBudget,
    private readonly port: BrowserCommandPort,
    private readonly mutations: BrowserMutationStore,
    private readonly authorityGuard: BrowserCommandAuthorityGuard,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public pendingMutationCommandIds(binding: BrowserExecutionBinding): readonly string[] {
    return this.mutations.dispatchedForBinding({
      jobId: binding.jobId,
      attemptId: binding.attemptId,
      leaseVersion: binding.leaseVersion,
      executionFenceHash: binding.writerFenceHash,
    });
  }

  public awaitPostSubmitQuiet(): Promise<void> {
    return awaitBrowserPostSubmitQuiet(() => this.mutations.latestProviderInputTerminalAt());
  }

  public readAtomicStepOutcome(
    binding: BrowserExecutionBinding,
    targetRef: string,
    identity: BrowserAtomicStepIdentity,
  ): BrowserAtomicStepOutcome | null {
    if (identity.replayPolicy === "observation-only") return null;
    return this.mutations.readAtomicStepOutcome({
      jobId: binding.jobId,
      attemptId: binding.attemptId,
      exactCallIdentityHash: hashValue([
        binding.jobId,
        binding.resultRevision,
        ...(identity.replayPolicy === "provider-effect-once"
          ? [] : [binding.attemptId, binding.writerFenceHash]),
        identity.productStepId,
        identity.callId,
        identity.childCapabilityId,
        identity.inputHash,
      ]),
      actionOrdinal: identity.actionOrdinal,
      targetRef,
      effectScope: identity.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
    });
  }

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    const commandSpan = startBrowserCommandSpan(this.runtimeLogger, permit);
    const mutation = isMutation(command);
    const state: BrowserCommandExecutionState = {
      budgetEntered: false, prepared: false,
      dispatched: false, terminalized: false,
    };
    try {
      assertAcceptedCommand(permit, command);
      this.authorityGuard.assertCurrentAuthority(permit);
      assertBrowserCommandTerminalReplyMargin(permit, command);
      this.budget.enter();
      state.budgetEntered = true;
      if (mutation) this.prepareMutation(permit, command, state);
      const reply = await this.port.send(permit, command, mutation ? () => {
        this.mutations.markDispatched(permit.commandId);
        state.dispatched = true;
        emitBrowserMutationEvent({
          runtimeLogger: this.runtimeLogger, mutation: permit, outcome: "DISPATCHED",
          authorityHash: this.mutations.authorityHash(permit.commandId),
        });
      } : undefined, mutation ? hashValue(browserMutationReceiptBindingProjection(
        this.mutations.readCommand(permit.commandId)!.identity)) : null);
      assertMatchingReply(permit, reply);
      this.authorityGuard.assertCurrentAuthority(permit);
      const preflight = decodeKnownGptRateLimitPreflightReply(permit, command, reply.result);
      const result = bindExactAssistantTurnReply(
        permit, command, bindBrowserCommandObservationPacket(permit, command, preflight.commandResult),
      );
      const boundReply = Object.freeze({ ...reply, result });
      if (mutation) this.completeMutation(
        permit, boundReply, reply.result, commandSpan, state,
      );
      if (preflight.specialFailureCode) {
        throw gptDialogPreflightFailure(reply.result, preflight.specialFailureCode);
      }
      completeBrowserCommandSpan({ span: commandSpan });
      state.terminalized = true;
      return result;
    } catch (error) {
      this.failExecution(permit, command, commandSpan, mutation, state, error);
    } finally {
      if (state.budgetEntered) this.budget.leave();
    }
  }

  private prepareMutation(
    permit: BrowserCommandPermit,
    command: BrowserGovernedCommand,
    state: BrowserCommandExecutionState,
  ): void {
    this.mutations.prepare(mutationIdentity(permit, command));
    state.prepared = true;
    emitBrowserMutationEvent({
      runtimeLogger: this.runtimeLogger, mutation: permit, outcome: "PREPARED",
      authorityHash: this.mutations.authorityHash(permit.commandId),
    });
    this.authorityGuard.assertCurrentAuthority(permit);
  }

  private completeMutation(
    permit: BrowserCommandPermit,
    reply: BrowserCommandReply,
    authenticatedReplyResult: unknown,
    commandSpan: ReturnType<typeof startBrowserCommandSpan>,
    state: BrowserCommandExecutionState,
  ): void {
    if (!state.dispatched) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const fact = reply.mutationReceipt;
    const settled = this.mutations.readCommand(permit.commandId);
    if (!fact || fact.commandId !== permit.commandId || settled?.state !==
      (fact.terminalReceipt.terminal === "confirmed" ? "CONFIRMED" : "REJECTED")) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const result = fact.terminalReceipt;
    if (result.terminal !== "rejected") return;
    const failureCode = result.failureCode ?? "BROWSER_POSTCONDITION_FAILED";
    const nativeCause = result.nativeCauseCode
      ? Object.assign(new Error(result.nativeCauseCode), { code: result.nativeCauseCode }) : undefined;
    const failureEvent = failBrowserCommandSpan({
      span: commandSpan, permit, proofHash: this.mutations.authorityHash(permit.commandId),
      failureCode, error: new Error(failureCode, { cause: nativeCause }),
    });
    state.terminalized = true;
    const rejected = failureCode === "BROWSER_KNOWN_GPT_RATE_LIMIT"
      || failureCode === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
      ? gptDialogPreflightFailure(authenticatedReplyResult, failureCode)
      : new Error(failureCode, { cause: nativeCause });
    throw withRuntimeLogCause(rejected, failureEvent.eventId);
  }

  private failExecution(
    permit: BrowserCommandPermit,
    command: BrowserGovernedCommand,
    commandSpan: ReturnType<typeof startBrowserCommandSpan>,
    mutation: boolean,
    state: BrowserCommandExecutionState,
    error: unknown,
  ): never {
    const terminalReply: AuthenticatedTerminalReplyFailure | null =
      mutation && state.dispatched && error instanceof BrowserCommandTerminalReplyError
      && error.replyChannelToken === permit.replyChannelToken
      && error.permitSequence === permit.sequence
        ? error : null;
    return failBrowserCommandExecution({
      permit, command, commandSpan, mutation, state, error, terminalReply,
      mutations: this.mutations, runtimeLogger: this.runtimeLogger,
    });
  }

  public hasDispatchedMutation(commandId: string): boolean {
    return this.mutations.readCommand(commandId)?.state === "DISPATCHED";
  }

  public mutationOutcome(commandId: string): "no" | "dispatched" | "confirmed" {
    return this.mutations.readMutationOutcome(commandId);
  }

  public browserOutcome(commandId: string): "DISPATCHED" | "CONFIRMED" | "REJECTED" | null {
    const state = this.mutations.readCommand(commandId)?.state;
    return state === "DISPATCHED" || state === "CONFIRMED" || state === "REJECTED" ? state : null;
  }

}
