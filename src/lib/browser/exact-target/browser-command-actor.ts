import type { BrowserCommandPermit } from "../transport/command-permit.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { withRuntimeLogCause, type RuntimeLogger } from "../../runtime-logs/index.js";
import { executionFailure } from "../../execution-failure.js";
import { assertBrowserDomIntent, type BrowserDomIntent, type BrowserDomObservationPacketV2 } from "./browser-dom-intent.js";
import { bindExactAssistantTurnReply } from "./browser-exact-assistant-turn-reply.js";
import { awaitBrowserPostSubmitQuiet, assertBrowserCommandTerminalReplyMargin, bindBrowserCommandObservationPacket,
  browserExactCallIdentityHash, browserProviderEffectIdentityHash, verifyNormalBrowserMutationReply } from "./browser-command-postcondition.js";
import { completeBrowserCommandSpan, emitBrowserCommandDiagnostic, emitBrowserMutationEvent, failBrowserCommandSpan, startBrowserCommandSpan } from "./browser-command-runtime-logging.js";
import { failBrowserCommandExecution, hashBrowserCommandValue as hashValue,
  type AuthenticatedTerminalReplyFailure, type BrowserCommandExecutionState } from "./browser-command-failure.js";
import { BrowserMutationStore } from "./browser-mutation-store.js";
import type { BrowserAtomicStepOutcome, BrowserMutationIdentity } from "./browser-mutation-types.js";
import type { BrowserAtomicStepIdentity, TransientDomConfirmationStage } from "./browser-target-lease.js";
import { browserMutationReceiptBindingProjection, type BrowserMutationTerminalFact } from "./browser-observation-receipt.js";
import { decodeKnownGptRateLimitPreflightReply, knownGptRateLimitPreflightFactValid, type BrowserPreflightReply } from "./browser-special-mutation-receipt.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";

export type BrowserGovernedCommand =
  | Readonly<{ kind: "dom-intent"; intent: BrowserDomIntent }>
  | Readonly<{ kind: "observe"; capabilityId: import("../protocol/generated/browser-protocol.generated.js").BrowserCapabilityId }>
  | Readonly<{ kind: "screenshot"; regionLabel: string }>
  | Readonly<{ kind: "file-input"; selector: string;
    activation: Readonly<{ selector: string; scope: Readonly<{ selector: string }>; expectedText: string }>;
    approvedFiles: readonly Readonly<{ grantRef: string; contentHash: `sha256:${string}`; maxBytes: number }>[];
    resolvedFilePaths: readonly string[] }>
  | Readonly<{ kind: "authenticated-media"; canonicalConversationUrl: string; userTurnId: string; semanticMediaId: "gpt-generated-image-main" }>
  | Readonly<{ kind: "wait"; durationMs: number; transientDomConfirmationStage?: never }>
  | Readonly<{ kind: "wait"; transientDomConfirmationStage: TransientDomConfirmationStage; durationMs?: never }>
  | Readonly<{ kind: "park-target"; reason: string }>;
export type BrowserCommandReply = Readonly<{ replyChannelToken: string; transportSequence: number; permitSequence: number;
  result: unknown; mutationReceipt: BrowserMutationTerminalFact | null }>;
export type BrowserCommandPort = Readonly<{ send(permit: BrowserCommandPermit, command: BrowserGovernedCommand,
  onDispatched?: () => void, receiptBindingHash?: `sha256:${string}` | null): Promise<BrowserCommandReply> }>;
export class BrowserCommandTerminalReplyError extends Error {
  public constructor(public readonly failureCode: string, public readonly replyChannelToken: string,
    public readonly transportSequence: number, public readonly permitSequence: number,
    public readonly commandStage: string | null = null) {
    super(failureCode); this.name = "BrowserCommandTerminalReplyError";
  }
}
export type BrowserCommandAuthorityGuard = Readonly<{ assertCurrentAuthority(permit: BrowserCommandPermit): void }>;
const isMutation = (command: BrowserGovernedCommand): boolean => command.kind === "file-input"
  || command.kind === "dom-intent" && ["click", "hover", "doubleClick", "keypress", "fill", "acknowledgeKnownGptRateLimit"].includes(command.intent.kind);
const postconditionPair = (command: BrowserGovernedCommand): Readonly<{ positive: `sha256:${string}`; negative: `sha256:${string}` }> => {
  if (!isMutation(command)) throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
  let positive: Readonly<Record<string, unknown>>;
  if (command.kind === "file-input") positive = { kind: "file-input", selector: command.selector,
    activation: command.activation, approvedFiles: command.approvedFiles, composerUploadObserved: true };
  else {
    if (command.kind !== "dom-intent") throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
    const intent = command.intent;
    switch (intent.kind) {
      case "acknowledgeKnownGptRateLimit": positive = { kind: intent.kind, exactKnownDialog: true, acknowledged: true,
        targetRefHash: intent.targetRefHash, documentRefHash: intent.documentRefHash }; break;
      case "fill": positive = { kind: "fill", selector: intent.selector, retainedValueHash: hashValue(intent.approvedText) }; break;
      case "click": positive = { kind: "click", selector: intent.selector,
        ...(intent.requiredClickPointSelector === undefined ? {} : { requiredClickPointSelector: intent.requiredClickPointSelector }),
        precondition: intent.preClickExactOutgoingTurn, postcondition: intent.postClickAttribute ?? intent.postClickMatch
          ?? intent.postClickObservation ?? intent.postClickUrl }; break;
      case "hover": positive = { kind: "hover", selector: intent.selector, postcondition: intent.postHoverAttribute }; break;
      case "doubleClick": positive = { kind: "doubleClick", selector: intent.selector, postcondition: intent.postDoubleClickMatch }; break;
      case "keypress": positive = { kind: "keypress", selector: intent.selector, key: intent.key, repeat: intent.repeat ?? 1,
        postcondition: intent.postKeypressMatch }; break;
      default: throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
    }
  }
  return Object.freeze({ positive: hashValue({ ...positive, result: "passed" }), negative: hashValue({ ...positive, result: "failed" }) });
};
const mutationIdentity = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): BrowserMutationIdentity => {
  const pair = postconditionPair(command), effectScope = permit.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local";
  const exactCallIdentityHash = browserExactCallIdentityHash(permit), payloadHash = hashValue(command);
  return { commandId: permit.commandId, logicalMutationId: effectScope === "provider_effect"
    ? browserProviderEffectIdentityHash(permit, payloadHash) : hashValue([exactCallIdentityHash, permit.targetRef]),
    exactCallIdentityHash, jobId: permit.jobId, resultRevision: permit.resultRevision, attemptId: permit.attemptId,
    leaseVersion: permit.leaseVersion, executionFenceHash: permit.writerFenceHash,
    deliveryPriorityReplayGrantHash: effectScope === "provider_effect" ? permit.deliveryPriorityReplayGrantHash : null,
    domainRejectionRevision: permit.domainRejectionRevision ?? false,
    deliveryPriorityReplayCall: effectScope === "provider_effect" ? permit.deliveryPriorityReplayCall ?? null : null,
    productStepId: permit.productStepId, callId: permit.callId, childCapabilityId: permit.childCapabilityId,
    effectScope, actionOrdinal: permit.actionOrdinal, targetRef: permit.targetRef, documentRef: permit.documentRef,
    actionId: permit.capabilityId, positivePostconditionHash: pair.positive, negativePostconditionHash: pair.negative,
    requestHash: permit.inputHash, payloadHash };
};
const gptDialogPreflightFailure = (value: unknown, code: Exclude<BrowserPreflightReply["specialFailureCode"], null>): Error => {
  const fact = (value as Record<string, unknown>).knownGptRateLimitPreflightFact;
  if (!knownGptRateLimitPreflightFactValid(fact)) return new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const hashes = [fact.exactCallIdentityHash, fact.targetRefHash, fact.documentRefHash, fact.observationHash];
  if (typeof fact.observedAt !== "string" || hashes.some(hash => typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash))) return new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return executionFailure("failed", code, { metadata: { mutationOutcome: "no", knownGptRateLimitPreflightFact: fact,
    evidence: { evidenceRef: [code === "BROWSER_KNOWN_GPT_RATE_LIMIT" ? "browser-known-gpt-rate-limit" : "browser-gpt-dialog-unrecognized",
      fact.observedAt, fact.exactCallIdentityHash, fact.targetRefHash, fact.documentRefHash].join("|"), evidenceHash: fact.observationHash as `sha256:${string}` } } });
};

const canonicalConversationReady = (value: string): boolean => {
  try { return requireCanonicalGptConversationUrl(value) === value; } catch { return false; }
};

type SubmittedConversationReadInput = Readonly<{
  binding: BrowserExecutionBinding; step: BrowserAtomicStepIdentity; targetRef: string;
  submitCallId: string; providerEffectIdentityHash: `sha256:${string}`; timeoutMs: number;
  execute(intent: BrowserDomIntent): Promise<unknown>; wait(durationMs: number): Promise<void>; assertCurrent(): string;
}>;

export class BrowserCommandActor {
  public constructor(private readonly budget: BrowserCommandAdmissionBudget, private readonly port: BrowserCommandPort,
    private readonly mutations: BrowserMutationStore, private readonly authorityGuard: BrowserCommandAuthorityGuard,
    private readonly runtimeLogger: RuntimeLogger, private readonly onProviderObservationTerminal?: () => void) {}
  public pendingMutationCommandIds(binding: BrowserExecutionBinding): readonly string[] {
    return this.mutations.dispatchedForBinding({ jobId: binding.jobId, attemptId: binding.attemptId,
      leaseVersion: binding.leaseVersion, executionFenceHash: binding.writerFenceHash });
  }
  public awaitPostSubmitQuiet(): Promise<void> { return awaitBrowserPostSubmitQuiet(() => this.mutations.latestProviderInputTerminalAt()); }
  private confirmedSubmitForLocator(input: SubmittedConversationReadInput) {
    if (input.step.childCapabilityId !== "get_submitted_gpt_conversation_url"
      || input.step.replayPolicy !== "observation-only" || !input.submitCallId
      || !Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 15_000) {
      throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_INVALID");
    }
    const fact = this.mutations.readProviderEffectStepCallFact({ ...input.binding,
      productStepId: input.step.productStepId, callId: input.submitCallId, childCapabilityId: "submit_exact_gpt_turn_once" });
    const outcome = fact?.confirmedOutcome;
    if (!fact || !outcome || outcome.state !== "confirmed" || outcome.mutationOutcome !== "confirmed"
      || outcome.physicalInputCount !== 1 || outcome.providerEffectIdentityHash !== input.providerEffectIdentityHash) {
      throw new Error("BROWSER_PROVIDER_EFFECT_FACT_INVALID");
    }
    return outcome;
  }
  public async readSubmittedConversationUrl(input: SubmittedConversationReadInput) {
    input.assertCurrent();
    const outcome = this.confirmedSubmitForLocator(input);
    if (outcome.conversationLocator) return outcome.conversationLocator;
    const original = this.mutations.readCommand(outcome.authorityRef.replace(/^browser-mutation:/u, ""));
    if (!original || original.identity.attemptId !== input.binding.attemptId
      || original.identity.resultRevision !== input.binding.resultRevision || outcome.targetRef !== input.targetRef) {
      throw new Error("BROWSER_SOURCE_EFFECT_IDENTITY_MISMATCH");
    }
    const proof = outcome.terminalPayload as Readonly<{ userTurnId: string }>;
    let deadline: number | null = null;
    while (true) {
      input.assertCurrent();
      const packet = await input.execute({ kind: "observe", queries: [{ queryId: "submitted-conversation-user",
        selector: `[data-turn-key='${proof.userTurnId}']:has([data-chatgpt-search-unit-key$=':user'])`,
        maxMatches: 1, fields: ["turnKey"] }] }) as BrowserDomObservationPacketV2;
      deadline ??= Date.parse(packet.observedAt) + input.timeoutMs;
      const query = packet.queries?.[0];
      if (packet.exactCallIdentityHash !== browserExactCallIdentityHash({ ...input.binding, ...input.step })
        || query?.rawCount !== 1 || query.eligibleCount !== 1 || query.matches[0]?.turnKey !== proof.userTurnId) {
        throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
      }
      if (Date.parse(packet.observedAt) > deadline) throw new Error("GPT_SUBMITTED_CONVERSATION_URL_INVALID");
      if (canonicalConversationReady(packet.currentUrl)) return this.mutations.bindSubmittedConversationLocator({
        binding: input.binding, productStepId: input.step.productStepId, submitCallId: input.submitCallId,
        providerEffectIdentityHash: input.providerEffectIdentityHash, packet, assertCurrent: input.assertCurrent });
      if (!Number.isFinite(deadline) || Date.now() + 1_500 >= deadline) throw new Error("GPT_SUBMITTED_CONVERSATION_URL_INVALID");
      await input.wait(1_500);
    }
  }
  public readAtomicStepOutcome(binding: BrowserExecutionBinding, targetRef: string, identity: BrowserAtomicStepIdentity): BrowserAtomicStepOutcome | null {
    if (identity.replayPolicy === "observation-only" || identity.resultRevision !== binding.resultRevision) return null;
    return this.mutations.readAtomicStepOutcome({ jobId: binding.jobId, attemptId: binding.attemptId,
      exactCallIdentityHash: browserExactCallIdentityHash({ ...binding, ...identity }), actionOrdinal: identity.actionOrdinal,
      targetRef, effectScope: identity.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local" });
  }
  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    const span = startBrowserCommandSpan(this.runtimeLogger, permit), mutation = isMutation(command);
    const observation = command.kind === "authenticated-media"
      || command.kind === "dom-intent" && command.intent.kind === "readExactAssistantTurn";
    let observationDispatched = false;
    const state: BrowserCommandExecutionState = { budgetEntered: false, prepared: false, dispatched: false, terminalized: false };
    try {
      assertValidCommandPermit(permit); if (command.kind === "dom-intent") assertBrowserDomIntent(command.intent);
      this.authorityGuard.assertCurrentAuthority(permit); assertBrowserCommandTerminalReplyMargin(permit, command);
      this.budget.enter(); state.budgetEntered = true;
      if (mutation) this.prepareMutation(permit, command, state);
      const bindingHash = mutation ? hashValue(browserMutationReceiptBindingProjection(this.mutations.readCommand(permit.commandId)!.identity)) : null;
      const reply = await this.port.send(permit, command, mutation || observation ? () => {
        if (observation) observationDispatched = true;
        if (mutation) {
          this.mutations.markDispatched(permit.commandId); state.dispatched = true;
          emitBrowserMutationEvent({ runtimeLogger: this.runtimeLogger, mutation: permit, outcome: "DISPATCHED",
            authorityHash: this.mutations.authorityHash(permit.commandId) });
        }
      } : undefined, bindingHash);
      if (reply.replyChannelToken !== permit.replyChannelToken || reply.permitSequence !== permit.sequence) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      if (mutation) this.completeMutation(permit, command, reply, span, state);
      else this.authorityGuard.assertCurrentAuthority(permit);
      const preflight = decodeKnownGptRateLimitPreflightReply(permit, command, reply.result);
      if (preflight.specialFailureCode) throw gptDialogPreflightFailure(reply.result, preflight.specialFailureCode);
      const result = bindExactAssistantTurnReply(permit, command, bindBrowserCommandObservationPacket(permit, command, preflight.commandResult));
      completeBrowserCommandSpan({ span }); state.terminalized = true; return result;
    } catch (error) { return this.failExecution(permit, command, span, mutation, state, error); }
    finally {
      if (state.budgetEntered) this.budget.leave();
      if (observationDispatched) this.onProviderObservationTerminal?.();
    }
  }

  private prepareMutation(permit: BrowserCommandPermit, command: BrowserGovernedCommand, state: BrowserCommandExecutionState): void {
    this.mutations.prepare(mutationIdentity(permit, command)); state.prepared = true;
    emitBrowserMutationEvent({ runtimeLogger: this.runtimeLogger, mutation: permit, outcome: "PREPARED", authorityHash: this.mutations.authorityHash(permit.commandId) });
    this.authorityGuard.assertCurrentAuthority(permit);
  }
  private completeMutation(permit: BrowserCommandPermit, command: BrowserGovernedCommand, reply: BrowserCommandReply,
    span: ReturnType<typeof startBrowserCommandSpan>, state: BrowserCommandExecutionState): void {
    if (!state.dispatched) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const fact = verifyNormalBrowserMutationReply(permit, command, { result: reply.result, mutationReceipt: reply.mutationReceipt });
    const row = this.mutations.readCommand(permit.commandId), receipt = fact.terminalReceipt;
    if (!row || row.state !== (receipt.terminal === "confirmed" ? "CONFIRMED" : "REJECTED")
      || fact.receiptBindingHash !== hashValue(browserMutationReceiptBindingProjection(row.identity))) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const readback = this.mutations.readExactCallMutationFact({ jobId: permit.jobId, attemptId: permit.attemptId,
      exactCallIdentityHash: row.identity.exactCallIdentityHash, actionOrdinal: permit.actionOrdinal });
    const expected = { authorityRef: `browser-mutation:${permit.commandId}`, mutationOutcome: receipt.mutationOutcome,
      physicalInputCount: receipt.physicalInputCount, terminalAt: receipt.completedAt,
      failureCode: receipt.failureCode, nativeFailureCode: receipt.nativeCauseCode };
    if (!readback || Object.entries(expected).some(([key, value]) => readback[key as keyof typeof readback] !== value)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    if (receipt.terminal !== "rejected") return;
    const code = receipt.failureCode ?? "BROWSER_POSTCONDITION_FAILED";
    const cause = receipt.nativeCauseCode ? Object.assign(new Error(receipt.nativeCauseCode), { code: receipt.nativeCauseCode }) : undefined;
    const event = failBrowserCommandSpan({ span, permit, proofHash: this.mutations.authorityHash(permit.commandId), failureCode: code, error: new Error(code, { cause }) });
    state.terminalized = true;
    const rejected = ["BROWSER_KNOWN_GPT_RATE_LIMIT", "BROWSER_GPT_DIALOG_UNRECOGNIZED"].includes(code)
      ? gptDialogPreflightFailure(reply.result, code as Exclude<BrowserPreflightReply["specialFailureCode"], null>) : new Error(code, { cause });
    throw withRuntimeLogCause(rejected, event.eventId);
  }
  private failExecution(permit: BrowserCommandPermit, command: BrowserGovernedCommand,
    span: ReturnType<typeof startBrowserCommandSpan>, mutation: boolean, state: BrowserCommandExecutionState, error: unknown): never {
    const terminalReply: AuthenticatedTerminalReplyFailure | null = mutation && state.dispatched
      && error instanceof BrowserCommandTerminalReplyError && error.replyChannelToken === permit.replyChannelToken
      && error.permitSequence === permit.sequence ? error : null;
    let failure = error;
    if (error instanceof BrowserCommandTerminalReplyError && error.commandStage !== null
      && error.replyChannelToken === permit.replyChannelToken && error.permitSequence === permit.sequence) {
      try { emitBrowserCommandDiagnostic(this.runtimeLogger, permit, error.commandStage); }
      catch (logError) {
        failure = new AggregateError([logError], error.failureCode, { cause: error });
      }
    }
    return failBrowserCommandExecution({ permit, command, commandSpan: span, mutation, state, error: failure, terminalReply,
      mutations: this.mutations, runtimeLogger: this.runtimeLogger });
  }
  public hasDispatchedMutation(commandId: string): boolean { return this.mutations.readCommand(commandId)?.state === "DISPATCHED"; }
  public mutationOutcome(commandId: string): "no" | "dispatched" | "confirmed" { return this.mutations.readMutationOutcome(commandId); }
  public browserOutcome(commandId: string): "DISPATCHED" | "CONFIRMED" | "REJECTED" | null {
    const state = this.mutations.readCommand(commandId)?.state;
    return state === "DISPATCHED" || state === "CONFIRMED" || state === "REJECTED" ? state : null;
  }
}
