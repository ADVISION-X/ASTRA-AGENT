import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { withRuntimeLogCause, type RuntimeLogger } from "../../runtime-logs/index.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import {
  completeBrowserCommandSpan,
  emitBrowserMutationEvent,
  failBrowserCommandSpan,
  startBrowserCommandSpan,
} from "./browser-command-runtime-logging.js";
import {
  BrowserMutationStore,
  type BrowserAtomicStepRecovery,
  type BrowserMutationIdentity,
} from "./browser-mutation-store.js";
import type { BrowserAtomicStepIdentity } from "./browser-target-lease.js";
import { assertPluginOutcomeResolution, type BrowserOutcomeResolutionReceipt } from "./browser-outcome-resolver.js";

export type BrowserGovernedCommand =
  | Readonly<{ kind: "navigate"; url: string; title: string }>
  | Readonly<{ kind: "dom-intent"; intent: BrowserDomIntent }>
  | Readonly<{ kind: "observe"; capabilityId: import("../protocol/generated/browser-protocol.generated.js").BrowserCapabilityId }>
  | Readonly<{ kind: "screenshot"; regionLabel: string }>
  | Readonly<{ kind: "file-input"; selector: string; grantRefs: readonly string[]; resolvedFilePaths: readonly string[] }>
  | Readonly<{
    kind: "authenticated-media";
    assistantTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
  }>
  | Readonly<{ kind: "wait"; durationMs: number }>
  | Readonly<{ kind: "park-target"; reason: string }>
  | Readonly<{ kind: "close-target"; reason: string }>;

export type BrowserCommandPort = Readonly<{
  send(
    permit: BrowserCommandPermit,
    command: BrowserGovernedCommand,
    onDispatched?: () => void,
  ): Promise<BrowserCommandReply>;
}>;

export type BrowserCommandReply = Readonly<{
  replyChannelToken: string;
  transportSequence: number;
  permitSequence: number;
  result: unknown;
}>;

export type BrowserCommandAuthorityGuard = Readonly<{
  assertCurrentAuthority(permit: BrowserCommandPermit): void;
}>;

type BrowserCommandExecutionState = {
  budgetEntered: boolean;
  prepared: boolean;
  dispatched: boolean;
  terminalized: boolean;
};

const hashValue = (value: unknown): `sha256:${string}` => {
  try {
    return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
  } catch {
    return `sha256:${createHash("sha256").update("unserializable").digest("hex")}`;
  }
};

const assertAcceptedCommand = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): void => {
  assertValidCommandPermit(permit);
  if (command.kind === "dom-intent") assertBrowserDomIntent(command.intent);
};

const isMutation = (command: BrowserGovernedCommand): boolean =>
  command.kind === "file-input"
  || (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "hover"
    || command.intent.kind === "doubleClick" || command.intent.kind === "keypress" || command.intent.kind === "fill"));

const postconditionPair = (command: BrowserGovernedCommand): Readonly<{
  positive: `sha256:${string}`;
  negative: `sha256:${string}`;
}> => {
  if (!isMutation(command)) throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
  if (command.kind === "file-input") {
    const positive = { kind: "file-input", selector: command.selector, grantRefs: command.grantRefs, attached: true };
    return Object.freeze({
      positive: hashValue({ ...positive, result: "passed" }),
      negative: hashValue({ ...positive, result: "failed" }),
    });
  }
  if (command.kind !== "dom-intent") throw new Error("BROWSER_ATOMIC_POSTCONDITION_REQUIRED");
  const intent = command.intent;
  let positive: Readonly<Record<string, unknown>>;
  switch (intent.kind) {
    case "fill":
      positive = { kind: "fill", selector: intent.selector, retainedValueHash: hashValue(intent.approvedText) };
      break;
    case "click":
      positive = { kind: "click", selector: intent.selector,
        postcondition: intent.postClickAttribute ?? intent.postClickMatch ?? intent.postClickUrl };
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
  const exactCallIdentityHash = hashValue([
    permit.jobId,
    permit.attemptId,
    permit.ownerPluginId,
    permit.pluginVersion,
    permit.productStepId,
    permit.callId,
    permit.childCapabilityId,
    permit.inputHash,
  ]);
  const targetScope = effectScope === "target_local" ? [permit.targetRef] : [];
  return {
    commandId: permit.commandId,
    logicalMutationId: targetScope.length === 0
      ? exactCallIdentityHash : hashValue([exactCallIdentityHash, ...targetScope]),
    exactCallIdentityHash,
    ownerPluginId: permit.ownerPluginId,
    pluginVersion: permit.pluginVersion,
    jobId: permit.jobId,
    attemptId: permit.attemptId,
    leaseVersion: permit.leaseVersion,
    executionFenceHash: permit.writerFenceHash,
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
    payloadHash: hashValue(command),
  };
};

const assertMatchingReply = (permit: BrowserCommandPermit, reply: BrowserCommandReply): void => {
  if (reply.replyChannelToken !== permit.replyChannelToken || reply.permitSequence !== permit.sequence) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const causalBrowserFailureCode = (error: unknown): string =>
  error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)
    ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";

const mutationReceipt = (
  command: BrowserGovernedCommand,
  result: unknown,
  replayPolicy: BrowserCommandPermit["replayPolicy"],
): "confirmed" | "rejected" | "unresolved" => {
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (value.candidateCount !== 1 || value.identityRevalidated !== true || value.mutationCount !== 1
    || typeof value.postconditionVerified !== "boolean") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (value.postconditionVerified === false) {
    if (value.failureCode !== "BROWSER_POSTCONDITION_FAILED") {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    return replayPolicy === "provider-effect-once" ? "unresolved" : "rejected";
  }
  if (command.kind === "dom-intent" && command.intent.kind === "fill"
    && value.retainedValueVerified !== true) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return "confirmed";
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
    return this.mutations.dispatchedForJob({
      jobId: binding.jobId,
      ownerPluginId: binding.ownerPluginId,
    });
  }

  public requiresMutationRecovery(binding: BrowserExecutionBinding, targetRef: string): boolean {
    const scope = this.mutations.callRecoveryScope({
      jobId: binding.jobId,
      attemptId: binding.attemptId,
      ownerPluginId: binding.ownerPluginId,
      pluginVersion: binding.pluginVersion,
      productStepId: binding.productStepId,
    });
    return scope?.state === "DISPATCHED" && scope.targetRef === targetRef;
  }

  public readAtomicStepRecovery(
    binding: BrowserExecutionBinding,
    targetRef: string,
    identity: BrowserAtomicStepIdentity,
  ): BrowserAtomicStepRecovery | null {
    if (identity.replayPolicy === "observation-only") return null;
    return this.mutations.atomicStepRecovery({
      jobId: binding.jobId,
      attemptId: binding.attemptId,
      ownerPluginId: binding.ownerPluginId,
      pluginVersion: binding.pluginVersion,
      exactCallIdentityHash: hashValue([
        binding.jobId,
        binding.attemptId,
        binding.ownerPluginId,
        binding.pluginVersion,
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
      budgetEntered: false, prepared: false, dispatched: false, terminalized: false,
    };
    try {
      assertAcceptedCommand(permit, command);
      this.authorityGuard.assertCurrentAuthority(permit);
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
      } : undefined);
      assertMatchingReply(permit, reply);
      this.authorityGuard.assertCurrentAuthority(permit);
      if (mutation) this.completeMutation(permit, command, reply, commandSpan, state);
      completeBrowserCommandSpan({ span: commandSpan });
      state.terminalized = true;
      return reply.result;
    } catch (error) {
      this.failExecution(permit, commandSpan, mutation, state, error);
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
    command: BrowserGovernedCommand,
    reply: BrowserCommandReply,
    commandSpan: ReturnType<typeof startBrowserCommandSpan>,
    state: BrowserCommandExecutionState,
  ): void {
    if (!state.dispatched) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const result = mutationReceipt(command, reply.result, permit.replayPolicy);
    if (result === "unresolved") throw new Error("BROWSER_COMMAND_RECEIPT_MISSING");
    const replyHash = hashValue(reply.result);
    if (result === "rejected") this.mutations.markRejected(permit.commandId, replyHash);
    else this.mutations.markConfirmed(permit.commandId, replyHash);
    emitBrowserMutationEvent({
      runtimeLogger: this.runtimeLogger, mutation: permit,
      outcome: result === "rejected" ? "REJECTED" : "CONFIRMED",
      authorityHash: this.mutations.authorityHash(permit.commandId),
    });
    if (result !== "rejected") return;
    const failureEvent = failBrowserCommandSpan({
      span: commandSpan, permit, proofHash: this.mutations.authorityHash(permit.commandId),
      failureCode: "BROWSER_POSTCONDITION_FAILED", pendingReceipt: false,
    });
    state.terminalized = true;
    throw withRuntimeLogCause(new Error("BROWSER_POSTCONDITION_FAILED"), failureEvent.eventId);
  }

  private failExecution(
    permit: BrowserCommandPermit,
    commandSpan: ReturnType<typeof startBrowserCommandSpan>,
    mutation: boolean,
    state: BrowserCommandExecutionState,
    error: unknown,
  ): never {
    if (state.terminalized) throw error;
    const code = mutation && state.dispatched ? "BROWSER_COMMAND_RECEIPT_MISSING" : causalBrowserFailureCode(error);
    if (mutation && state.prepared) {
      if (state.dispatched) this.mutations.markReceiptMissing(permit.commandId);
      else this.mutations.markFailedBeforeDispatch(permit.commandId, code);
      if (!state.dispatched) emitBrowserMutationEvent({
        runtimeLogger: this.runtimeLogger, mutation: permit,
        outcome: "FAILED",
        authorityHash: this.mutations.authorityHash(permit.commandId),
      });
    }
    const failureEvent = failBrowserCommandSpan({
      span: commandSpan, permit,
      proofHash: mutation && state.prepared ? this.mutations.authorityHash(permit.commandId) : hashValue(code),
      failureCode: code, error, pendingReceipt: mutation && state.dispatched,
    });
    throw withRuntimeLogCause(new Error(code, { cause: error }), failureEvent.eventId);
  }

  public hasDispatchedMutation(commandId: string): boolean {
    return this.mutations.readDispatched(commandId) !== null;
  }

  public mutationOutcome(commandId: string): "no" | "dispatched" | "confirmed" {
    const state = this.mutations.readState(commandId);
    if (state === "DISPATCHED") return "dispatched";
    if (state === "CONFIRMED" || state === "REJECTED") return "confirmed";
    return "no";
  }

  public browserOutcome(commandId: string): "DISPATCHED" | "CONFIRMED" | "REJECTED" | null {
    const state = this.mutations.readState(commandId);
    return state === "DISPATCHED" || state === "CONFIRMED" || state === "REJECTED" ? state : null;
  }

  public async resolveDispatchedMutation(receipt: BrowserOutcomeResolutionReceipt): Promise<void> {
    const entry = this.mutations.readDispatched(receipt.commandId);
    if (!entry) throw new Error("BROWSER_MUTATION_UNSETTLED");
    assertPluginOutcomeResolution(receipt, entry.ownerPluginId);
    if (receipt.uniqueTargetRef !== entry.targetRef) throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
    const state = receipt.outcome === "TERMINAL_SUCCESS" ? "CONFIRMED" : "REJECTED";
    this.mutations.resolve({
      commandId: receipt.commandId,
      ownerPluginId: receipt.ownerPluginId,
      targetRef: receipt.uniqueTargetRef,
      state,
      proofHash: hashValue(receipt),
    });
    emitBrowserMutationEvent({
      runtimeLogger: this.runtimeLogger,
      mutation: entry,
      outcome: state,
      authorityHash: this.mutations.authorityHash(receipt.commandId),
    });
  }
}
