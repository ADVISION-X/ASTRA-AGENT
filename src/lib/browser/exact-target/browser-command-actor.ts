import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import { emitBrowserCommandCompleted, emitBrowserCommandFailed, emitBrowserCommandStarted } from "./browser-command-runtime-logging.js";
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
  || (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "fill"));

const mutationIdentity = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): BrowserMutationIdentity => ({
  commandId: permit.commandId,
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
    && Boolean(command.intent.postClickAttribute) && value.postconditionVerified === true;
  if (value.candidateCount !== 1 || value.identityRevalidated !== true || value.mutationCount !== 1
    || (command.intent.kind === "fill" && !retained)
    || (command.intent.kind === "click" && command.intent.postClickAttribute && !postcondition)) {
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

  public pendingMutationCommandIds(binding: Readonly<{
    jobId: string;
    attemptId: string;
    leaseVersion: number;
    writerFenceHash: string;
  }>): readonly string[] {
    return this.mutations.unknownForBinding({
      jobId: binding.jobId,
      attemptId: binding.attemptId,
      leaseVersion: binding.leaseVersion,
      executionFenceHash: binding.writerFenceHash,
    });
  }

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    const startedAt = performance.now();
    const beforeHash = hashValue([permit.targetRef, permit.documentRef]);
    emitBrowserCommandStarted({ runtimeLogger: this.runtimeLogger, permit, beforeHash });
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
        this.authorityGuard.assertCurrentAuthority(permit);
        this.mutations.markSent(permit.commandId);
      }
      sent = true;
      const reply = await this.port.send(permit, command);
      assertMatchingReply(permit, reply);
      this.authorityGuard.assertCurrentAuthority(permit);
      if (mutation) {
        assertMutationReply(command, reply.result);
        this.mutations.markUnknown(permit.commandId, "awaiting owning-plugin postcondition", hashValue(reply.result));
      }
      const durationMs = Math.max(0, performance.now() - startedAt);
      if (mutation) {
        emitBrowserCommandFailed({
          runtimeLogger: this.runtimeLogger, permit, beforeHash, afterHash: hashValue(reply.result),
          durationMs, failureCode: "BROWSER_OUTCOME_UNKNOWN", outcomeUnknown: true,
        });
      } else {
        emitBrowserCommandCompleted({
          runtimeLogger: this.runtimeLogger, permit, beforeHash, afterHash: hashValue(reply.result), durationMs,
        });
      }
      return reply.result;
    } catch (error) {
      const code = failureCode(mutation, sent, error);
      if (mutation && prepared) {
        if (sent) this.mutations.markUnknown(permit.commandId, code);
        else this.mutations.markFailedBeforeSend(permit.commandId, code);
      }
      emitBrowserCommandFailed({
        runtimeLogger: this.runtimeLogger, permit, beforeHash, afterHash: hashValue(code),
        durationMs: Math.max(0, performance.now() - startedAt), failureCode: code,
        outcomeUnknown: code === "BROWSER_OUTCOME_UNKNOWN",
      });
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
  }
}
