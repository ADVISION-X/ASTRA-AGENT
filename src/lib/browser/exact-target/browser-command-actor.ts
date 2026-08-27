import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { requireRuntimeLogWrite, withRuntimeLogCause, type RuntimeLogger } from "../../runtime-logs/index.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import {
  completeBrowserCommandSpan,
  emitBrowserMutationState,
  failBrowserCommandSpan,
  startBrowserCommandSpan,
} from "./browser-command-runtime-logging.js";
import { BrowserMutationStore, type BrowserMutationIdentity } from "./browser-mutation-store.js";
import { assertPluginOutcomeResolution, type BrowserOutcomeResolutionReceipt } from "./browser-outcome-resolver.js";

export type BrowserGovernedCommand =
  | Readonly<{ kind: "navigate"; url: string; title: string }>
  | Readonly<{ kind: "dom-intent"; intent: BrowserDomIntent }>
  | Readonly<{ kind: "observe"; capabilityId: import("../protocol/generated/browser-protocol.generated.js").BrowserCapabilityId }>
  | Readonly<{ kind: "screenshot"; regionLabel: string }>
  | Readonly<{ kind: "file-input"; selector: string; grantRefs: readonly string[]; resolvedFilePaths: readonly string[] }>
  | Readonly<{ kind: "wait"; durationMs: number }>
  | Readonly<{ kind: "close-target"; reason: string }>;

export type BrowserCommandPort = Readonly<{
  send(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<BrowserCommandReply>;
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

const mutationIdentity = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): BrowserMutationIdentity => ({
  commandId: permit.commandId,
  logicalMutationId: hashValue([
    permit.jobId,
    `${permit.ownerPluginId}:${permit.capabilityId}`,
    permit.sequence,
    hashValue(command),
  ]),
  ownerPluginId: permit.ownerPluginId,
  jobId: permit.jobId,
  attemptId: permit.attemptId,
  leaseVersion: permit.leaseVersion,
  executionFenceHash: permit.writerFenceHash,
  targetRef: permit.targetRef,
  documentRef: permit.documentRef,
  actionId: permit.capabilityId,
  requestHash: hashValue(permit),
  payloadHash: hashValue(command),
});

const assertMatchingReply = (permit: BrowserCommandPermit, reply: BrowserCommandReply): void => {
  if (reply.replyChannelToken !== permit.replyChannelToken || reply.permitSequence !== permit.sequence) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const causalBrowserFailureCode = (error: unknown): string =>
  error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)
    ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";

const failureCode = (mutation: boolean, sent: boolean, error: unknown): string =>
  mutation && sent ? "BROWSER_OUTCOME_UNKNOWN" : causalBrowserFailureCode(error);

const assertMutationReply = (command: BrowserGovernedCommand, result: unknown): void => {
  if (command.kind !== "dom-intent") return;
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const retained = command.intent.kind === "fill" && value.retainedValueVerified === true;
  const postcondition = command.intent.kind === "click"
    && Boolean(command.intent.postClickAttribute ?? command.intent.postClickMatch)
    && value.postconditionVerified === true;
  const hoverPostcondition = command.intent.kind === "hover"
    && value.postconditionVerified === true;
  const directPostcondition = (command.intent.kind === "doubleClick" || command.intent.kind === "keypress")
    && value.postconditionVerified === true;
  if (value.candidateCount !== 1 || value.identityRevalidated !== true || value.mutationCount !== 1
    || (command.intent.kind === "fill" && !retained)
    || (command.intent.kind === "click"
      && (command.intent.postClickAttribute ?? command.intent.postClickMatch)
      && !postcondition)
    || (command.intent.kind === "hover" && !hoverPostcondition)
    || ((command.intent.kind === "doubleClick" || command.intent.kind === "keypress") && !directPostcondition)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

export class BrowserCommandActor {
  private readonly pendingCommandSpans = new Map<string, ReturnType<typeof startBrowserCommandSpan>>();
  private readonly executionStates = new Map<string, "idle" | "busy" | "failed" | "review_required">();

  public constructor(
    private readonly budget: BrowserCommandAdmissionBudget,
    private readonly port: BrowserCommandPort,
    private readonly mutations: BrowserMutationStore,
    private readonly authorityGuard: BrowserCommandAuthorityGuard,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public pendingMutationCommandIds(binding: BrowserExecutionBinding): readonly string[] {
    if (binding.kind === "production-reconciliation") {
      return this.mutations.unknownForJob({
        jobId: binding.jobId,
        ownerPluginId: binding.ownerPluginId,
      });
    }
    return this.mutations.unknownForBinding({
      jobId: binding.jobId,
      attemptId: binding.attemptId,
      leaseVersion: binding.leaseVersion,
      executionFenceHash: binding.writerFenceHash,
    });
  }

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    const commandSpan = startBrowserCommandSpan(this.runtimeLogger, permit);
    this.emitExecutionState(permit.jobId, "busy");
    const mutation = isMutation(command);
    let budgetEntered = false;
    let prepared = false;
    let sent = false;
    try {
      assertAcceptedCommand(permit, command);
      this.authorityGuard.assertCurrentAuthority(permit);
      this.budget.enter();
      budgetEntered = true;
      if (mutation) {
        this.mutations.prepare(mutationIdentity(permit, command));
        prepared = true;
        emitBrowserMutationState({
          runtimeLogger: this.runtimeLogger, mutation: permit, previous: null, current: "PREPARED",
          authorityHash: this.mutations.authorityHash(permit.commandId),
        });
        this.authorityGuard.assertCurrentAuthority(permit);
        this.mutations.markSent(permit.commandId);
        sent = true;
        emitBrowserMutationState({
          runtimeLogger: this.runtimeLogger, mutation: permit, previous: "PREPARED", current: "SENT",
          authorityHash: this.mutations.authorityHash(permit.commandId),
        });
      }
      sent = true;
      const reply = await this.port.send(permit, command);
      assertMatchingReply(permit, reply);
      this.authorityGuard.assertCurrentAuthority(permit);
      if (mutation) {
        assertMutationReply(command, reply.result);
        const replyHash = hashValue(reply.result);
        this.mutations.markUnknown(permit.commandId, "awaiting owning-plugin postcondition", replyHash);
        emitBrowserMutationState({
          runtimeLogger: this.runtimeLogger, mutation: permit, previous: "SENT", current: "UNKNOWN",
          authorityHash: this.mutations.authorityHash(permit.commandId),
        });
      }
      if (mutation) {
        this.pendingCommandSpans.set(permit.commandId, commandSpan);
        this.emitExecutionState(permit.jobId, "review_required");
      } else {
        completeBrowserCommandSpan({ span: commandSpan });
        this.emitExecutionState(permit.jobId, "idle");
      }
      return reply.result;
    } catch (error) {
      const code = failureCode(mutation, sent, error);
      if (mutation && prepared) {
        if (sent) {
          this.mutations.markUnknown(permit.commandId, code);
          emitBrowserMutationState({
            runtimeLogger: this.runtimeLogger, mutation: permit, previous: "SENT", current: "UNKNOWN",
            authorityHash: this.mutations.authorityHash(permit.commandId),
          });
        } else {
          this.mutations.markFailedBeforeSend(permit.commandId, code);
          emitBrowserMutationState({
            runtimeLogger: this.runtimeLogger, mutation: permit, previous: "PREPARED", current: "FAILED",
            authorityHash: this.mutations.authorityHash(permit.commandId),
          });
        }
      }
      if (code === "BROWSER_OUTCOME_UNKNOWN") this.pendingCommandSpans.set(permit.commandId, commandSpan);
      else {
        const failureEvent = failBrowserCommandSpan({
          span: commandSpan,
          permit,
          proofHash: mutation && prepared ? this.mutations.authorityHash(permit.commandId) : hashValue(code),
          failureCode: code,
          outcomeUnknown: false,
        });
        this.emitExecutionState(permit.jobId, "failed");
        throw withRuntimeLogCause(new Error(code, { cause: error }), failureEvent.eventId);
      }
      this.emitExecutionState(permit.jobId, "review_required");
      throw new Error(code, { cause: error });
    } finally {
      if (budgetEntered) this.budget.leave();
    }
  }

  public hasUnknownMutation(commandId: string): boolean {
    return this.mutations.readUnknown(commandId) !== null;
  }

  public async resolveUnknownMutation(receipt: BrowserOutcomeResolutionReceipt): Promise<void> {
    const entry = this.mutations.readUnknown(receipt.commandId);
    if (!entry) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    assertPluginOutcomeResolution(receipt, entry.ownerPluginId);
    if (receipt.uniqueTargetRef !== entry.targetRef) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    this.mutations.resolve({
      commandId: receipt.commandId,
      ownerPluginId: receipt.ownerPluginId,
      targetRef: receipt.uniqueTargetRef,
      state: receipt.outcome === "TERMINAL_SUCCESS" ? "CONFIRMED" : "FAILED",
      proofHash: hashValue(receipt),
    });
    const authorityHash = this.mutations.authorityHash(receipt.commandId);
    emitBrowserMutationState({
      runtimeLogger: this.runtimeLogger,
      mutation: entry,
      previous: "UNKNOWN",
      current: receipt.outcome === "TERMINAL_SUCCESS" ? "CONFIRMED" : "FAILED",
      authorityHash,
    });
    const span = this.pendingCommandSpans.get(receipt.commandId);
    if (span) {
      if (receipt.outcome === "TERMINAL_SUCCESS") {
        requireRuntimeLogWrite(span.terminal({
          outcome: "success",
          authorityRef: `browser-mutation:${receipt.commandId}`,
          authorityHash,
        }));
      } else {
        failBrowserCommandSpan({
          span,
          permit: {
            commandId: entry.commandId,
            jobId: entry.jobId,
            mutationClass: "mutation",
          },
          proofHash: authorityHash,
          failureCode: "BROWSER_MUTATION_TERMINAL_FAILED",
          outcomeUnknown: false,
        });
      }
      this.pendingCommandSpans.delete(receipt.commandId);
      this.emitExecutionState(entry.jobId, receipt.outcome === "TERMINAL_SUCCESS" ? "idle" : "failed");
    }
  }

  private emitExecutionState(jobId: string, current: "idle" | "busy" | "failed" | "review_required"): void {
    const previous = this.executionStates.get(jobId) ?? null;
    requireRuntimeLogWrite(this.runtimeLogger.emitState({
      traceId: jobId,
      owner: "browser-session",
      component: "browser-command",
      stateKey: "browser.execution",
      previous,
      current,
    }));
    this.executionStates.set(jobId, current);
  }
}
