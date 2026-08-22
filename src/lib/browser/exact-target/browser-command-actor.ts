import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import {
  emitBrowserCommandCompleted,
  emitBrowserCommandFailed,
  emitBrowserCommandStarted,
} from "./browser-command-runtime-logging.js";
import type { BrowserMutationIntentJournal, BrowserMutationJournalEntry } from "./browser-mutation-intent-journal.js";
import {
  assertPluginOutcomeResolution,
  type BrowserOutcomeResolutionReceipt,
} from "./browser-outcome-resolver.js";

export type BrowserGovernedCommand =
  | Readonly<{ kind: "navigate"; url: string; title: string }>
  | Readonly<{ kind: "dom-intent"; intent: BrowserDomIntent }>
  | Readonly<{ kind: "observe"; capabilityId: import("../protocol/generated/browser-protocol.generated.js").BrowserCapabilityId }>
  | Readonly<{ kind: "screenshot"; regionLabel: string }>
  | Readonly<{
      kind: "file-input";
      selector: string;
      grantRefs: readonly string[];
      resolvedFilePaths: readonly string[];
    }>
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

type MutationJournalBase = Omit<BrowserMutationJournalEntry, "recordedAt" | "reason" | "state">;

const assertAcceptedCommand = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): void => {
  assertValidCommandPermit(permit);
  if (command.kind === "dom-intent") assertBrowserDomIntent(command.intent);
};

const isMutation = (command: BrowserGovernedCommand): boolean =>
  command.kind === "file-input"
  || (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "fill"));

const createMutationJournalBase = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): MutationJournalBase | null =>
  isMutation(command)
    ? {
      commandId: permit.commandId,
      actionId: permit.capabilityId,
      workspaceRef: permit.workspaceRef,
      authorityRef: permit.authorityRef,
      authorityCertificateHash: permit.certificateHash,
      executionBindingHash: permit.executionBindingHash,
      executionFenceHash: permit.writerFenceHash,
      candidateHash: permit.candidateHash,
      contractManifestHash: permit.contractManifestHash,
      ownerPluginId: permit.ownerPluginId,
      jobId: permit.jobId,
      attemptId: permit.attemptId,
      deviceId: permit.deviceId,
      leaseVersion: permit.leaseVersion,
      localOrderId: permit.localOrderId,
      targetRef: permit.targetRef,
      documentRef: permit.documentRef,
      commandTtlMs: permit.commandTtlMs,
      mutationClass: "mutation",
      payloadHash: `sha256:${createHash("sha256").update(JSON.stringify(command)).digest("hex")}`,
      artifactRefs: command.kind === "file-input" ? command.grantRefs : [],
    }
    : null;

const recordMutation = async (
  journal: BrowserMutationIntentJournal,
  entry: MutationJournalBase | null,
  state: BrowserMutationJournalEntry["state"],
  reason?: string,
): Promise<void> => {
  if (!entry) return;
  await journal.record({ ...entry, state, recordedAt: new Date().toISOString(), ...(reason === undefined ? {} : { reason }) });
};

const assertMatchingReply = (permit: BrowserCommandPermit, reply: BrowserCommandReply): void => {
  if (reply.replyChannelToken !== permit.replyChannelToken || reply.permitSequence !== permit.sequence) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const causalBrowserFailureCode = (error: unknown): string =>
  error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)
    ? error.message
    : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";

const failureCode = (
  entry: MutationJournalBase | null,
  sent: boolean,
  error: unknown,
): string => entry !== null && sent
  ? "BROWSER_OUTCOME_UNKNOWN"
  : causalBrowserFailureCode(error);

const hashLogValue = (value: unknown): string => {
  try {
    return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
  } catch {
    return `sha256:${createHash("sha256").update("unserializable").digest("hex")}`;
  }
};

export class BrowserCommandActor {
  private readonly unknownMutations = new Map<string, MutationJournalBase>();

  public constructor(
    private readonly budget: BrowserCommandAdmissionBudget,
    private readonly port: BrowserCommandPort,
    private readonly journal: BrowserMutationIntentJournal,
    private readonly authorityGuard: BrowserCommandAuthorityGuard,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    const startedAt = performance.now();
    const beforeHash = hashLogValue([permit.targetRef, permit.documentRef]);
    emitBrowserCommandStarted({ runtimeLogger: this.runtimeLogger, permit, beforeHash });
    let budgetEntered = false;
    let journalEntry: MutationJournalBase | null = null;
    let sent = false;
    try {
      assertAcceptedCommand(permit, command);
      this.authorityGuard.assertCurrentAuthority(permit);
      this.budget.enter();
      budgetEntered = true;
      journalEntry = createMutationJournalBase(permit, command);
      await recordMutation(this.journal, journalEntry, "PREPARED");
      this.authorityGuard.assertCurrentAuthority(permit);
      await recordMutation(this.journal, journalEntry, "SEND");
      sent = true;
      const reply = await this.port.send(permit, command);
      assertMatchingReply(permit, reply);
      this.authorityGuard.assertCurrentAuthority(permit);
      // A transport reply proves only that the extension received a frame.
      // The owning Plugin alone may turn a mutation into CONFIRMED after its
      // page-level positive/negative/unique/bounded outcome evidence exists.
      await recordMutation(
        this.journal,
        journalEntry,
        "UNKNOWN",
        "transport reply requires owning-plugin outcome resolution",
      );
      if (journalEntry) this.unknownMutations.set(permit.commandId, journalEntry);
      const durationMs = Math.max(0, performance.now() - startedAt);
      if (journalEntry) {
        emitBrowserCommandFailed({
          runtimeLogger: this.runtimeLogger,
          permit,
          beforeHash,
          afterHash: hashLogValue(reply.result),
          durationMs,
          failureCode: "BROWSER_OUTCOME_UNKNOWN",
          outcomeUnknown: true,
        });
      } else {
        emitBrowserCommandCompleted({
          runtimeLogger: this.runtimeLogger,
          permit,
          beforeHash,
          afterHash: hashLogValue(reply.result),
          durationMs,
        });
      }
      return reply.result;
    } catch (error) {
      const code = failureCode(journalEntry, sent, error);
      await recordMutation(this.journal, journalEntry, sent ? "UNKNOWN" : "FAILED", code);
      if (journalEntry && sent) this.unknownMutations.set(permit.commandId, journalEntry);
      emitBrowserCommandFailed({
        runtimeLogger: this.runtimeLogger,
        permit,
        beforeHash,
        afterHash: hashLogValue(code),
        durationMs: Math.max(0, performance.now() - startedAt),
        failureCode: code,
        outcomeUnknown: code === "BROWSER_OUTCOME_UNKNOWN",
      });
      throw new Error(code, { cause: error });
    } finally {
      if (budgetEntered) this.budget.leave();
    }
  }

  public hasUnknownMutation(commandId: string): boolean {
    return this.unknownMutations.has(commandId);
  }

  public async resolveUnknownMutation(
    receipt: BrowserOutcomeResolutionReceipt,
  ): Promise<void> {
    const entry = this.unknownMutations.get(receipt.commandId);
    if (!entry) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    assertPluginOutcomeResolution(receipt, entry.ownerPluginId);
    if (receipt.uniqueTargetRef !== entry.targetRef) {
      throw new Error("BROWSER_OUTCOME_UNKNOWN");
    }
    await recordMutation(
      this.journal,
      entry,
      receipt.outcome === "TERMINAL_SUCCESS" ? "CONFIRMED" : "FAILED",
      `owning-plugin:${receipt.ownerPluginId}`,
    );
    this.unknownMutations.delete(receipt.commandId);
  }
}
