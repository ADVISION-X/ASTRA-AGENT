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
import type { BrowserProofCommandEvent, BrowserProofJournal } from "./browser-proof-journal.js";
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

type CommandJournalBase = Omit<BrowserProofCommandEvent,
  "artifactRefs" | "phase" | "recordedAt" | "reason" | "resultHash" | "resultSummary" | "transportSequence" | "permitSequence">;

const assertAcceptedCommand = (permit: BrowserCommandPermit, command: BrowserGovernedCommand): void => {
  assertValidCommandPermit(permit);
  if (command.kind === "dom-intent") assertBrowserDomIntent(command.intent);
};

const isMutation = (command: BrowserGovernedCommand): boolean =>
  command.kind === "file-input"
  || (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "fill"));

const commandClass = (command: BrowserGovernedCommand): CommandJournalBase["commandClass"] =>
  isMutation(command) ? "mutation"
    : command.kind === "navigate" || command.kind === "close-target" ? "lifecycle"
      : "observation";

const createCommandJournalBase = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
): CommandJournalBase => ({
      eventType: "COMMAND",
      commandId: permit.commandId,
      actionId: permit.capabilityId,
      commandKind: command.kind,
      ...(command.kind === "dom-intent" ? { domIntentKind: command.intent.kind } : {}),
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
      commandClass: commandClass(command),
      payloadHash: `sha256:${createHash("sha256").update(JSON.stringify(command)).digest("hex")}`,
    });

const recordCommand = (
  journal: BrowserProofJournal,
  entry: CommandJournalBase,
  phase: BrowserProofCommandEvent["phase"],
  details: Readonly<{
    artifactRefs?: readonly string[];
    permitSequence?: number;
    reason?: string;
    resultHash?: `sha256:${string}`;
    resultSummary?: BrowserProofCommandEvent["resultSummary"];
    transportSequence?: number;
  }> = {},
): void => {
  journal.recordCommand({
    ...entry,
    phase,
    recordedAt: new Date().toISOString(),
    artifactRefs: details.artifactRefs ?? [],
    ...(details.reason === undefined ? {} : { reason: details.reason }),
    ...(details.resultHash === undefined ? {} : { resultHash: details.resultHash }),
    ...(details.resultSummary === undefined ? {} : { resultSummary: details.resultSummary }),
    ...(details.transportSequence === undefined ? {} : { transportSequence: details.transportSequence }),
    ...(details.permitSequence === undefined ? {} : { permitSequence: details.permitSequence }),
  });
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
  mutation: boolean,
  sent: boolean,
  error: unknown,
): string => mutation && sent
  ? "BROWSER_OUTCOME_UNKNOWN"
  : causalBrowserFailureCode(error);

const hashLogValue = (value: unknown): string => {
  try {
    return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
  } catch {
    return `sha256:${createHash("sha256").update("unserializable").digest("hex")}`;
  }
};

const verifiedMutationResult = (
  command: Extract<BrowserGovernedCommand, { kind: "dom-intent" }>,
  result: unknown,
): Readonly<{ retainedValueVerified?: true; postconditionVerified?: true }> => {
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const retained = command.intent.kind === "fill" && value.retainedValueVerified === true;
  const postcondition = command.intent.kind === "click"
    && Boolean(command.intent.postClickAttribute) && value.postconditionVerified === true;
  if (value.candidateCount !== 1 || value.identityRevalidated !== true || value.mutationCount !== 1
    || (command.intent.kind === "fill" && !retained)
    || (command.intent.kind === "click" && command.intent.postClickAttribute && !postcondition)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return {
    ...(retained ? { retainedValueVerified: true as const } : {}),
    ...(postcondition ? { postconditionVerified: true as const } : {}),
  };
};

const domMutationResultSummary = (
  command: BrowserGovernedCommand,
  result: unknown,
): BrowserProofCommandEvent["resultSummary"] | undefined => {
  if (command.kind !== "dom-intent" || (command.intent.kind !== "click" && command.intent.kind !== "fill")) return undefined;
  return {
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    ...verifiedMutationResult(command, result),
  };
};

const acceptCommandReply = (input: Readonly<{
  permit: BrowserCommandPermit;
  command: BrowserGovernedCommand;
  reply: BrowserCommandReply;
  authorityGuard: BrowserCommandAuthorityGuard;
  journal: BrowserProofJournal;
  journalEntry: CommandJournalBase;
}>): Readonly<{ mutation: boolean; resultHash: `sha256:${string}` }> => {
  assertMatchingReply(input.permit, input.reply);
  input.authorityGuard.assertCurrentAuthority(input.permit);
  const mutation = isMutation(input.command);
  const resultHash = hashLogValue(input.reply.result) as `sha256:${string}`;
  const resultSummary = domMutationResultSummary(input.command, input.reply.result);
  const artifactRefs = input.reply.result && typeof input.reply.result === "object"
    && typeof (input.reply.result as { artifactRef?: unknown }).artifactRef === "string"
    ? [(input.reply.result as { artifactRef: string }).artifactRef]
    : [];
  recordCommand(input.journal, input.journalEntry, mutation ? "UNKNOWN" : "COMPLETED", {
    artifactRefs,
    permitSequence: input.reply.permitSequence,
    resultHash,
    ...(resultSummary ? { resultSummary } : {}),
    transportSequence: input.reply.transportSequence,
    ...(mutation ? { reason: "transport reply requires owning-plugin outcome resolution" } : {}),
  });
  return { mutation, resultHash };
};

export class BrowserCommandActor {
  private readonly unknownMutations = new Map<string, CommandJournalBase>();

  public constructor(
    private readonly budget: BrowserCommandAdmissionBudget,
    private readonly port: BrowserCommandPort,
    private readonly journal: BrowserProofJournal,
    private readonly authorityGuard: BrowserCommandAuthorityGuard,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    const startedAt = performance.now();
    const beforeHash = hashLogValue([permit.targetRef, permit.documentRef]);
    emitBrowserCommandStarted({ runtimeLogger: this.runtimeLogger, permit, beforeHash });
    let budgetEntered = false;
    let journalEntry: CommandJournalBase | null = null;
    let sent = false;
    try {
      assertAcceptedCommand(permit, command);
      this.authorityGuard.assertCurrentAuthority(permit);
      this.budget.enter();
      budgetEntered = true;
      journalEntry = createCommandJournalBase(permit, command);
      recordCommand(this.journal, journalEntry, "PREPARED", {
        artifactRefs: command.kind === "file-input" ? command.grantRefs : [],
      });
      this.authorityGuard.assertCurrentAuthority(permit);
      recordCommand(this.journal, journalEntry, "SEND");
      sent = true;
      const reply = await this.port.send(permit, command);
      // A transport reply proves only that the extension received a frame.
      // The owning Plugin alone may turn a mutation into CONFIRMED after its
      // page-level positive/negative/unique/bounded outcome evidence exists.
      const { mutation, resultHash } = acceptCommandReply({
        permit, command, reply,
        authorityGuard: this.authorityGuard,
        journal: this.journal,
        journalEntry,
      });
      if (mutation) this.unknownMutations.set(permit.commandId, journalEntry);
      const durationMs = Math.max(0, performance.now() - startedAt);
      if (mutation) {
        emitBrowserCommandFailed({
          runtimeLogger: this.runtimeLogger,
          permit,
          beforeHash,
          afterHash: resultHash,
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
      const mutation = isMutation(command);
      const code = failureCode(mutation, sent, error);
      if (journalEntry) recordCommand(this.journal, journalEntry, mutation && sent ? "UNKNOWN" : "FAILED", { reason: code });
      if (journalEntry && mutation && sent) this.unknownMutations.set(permit.commandId, journalEntry);
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
    recordCommand(this.journal, entry, receipt.outcome === "TERMINAL_SUCCESS" ? "CONFIRMED" : "FAILED", {
      artifactRefs: [receipt.positiveEvidenceRef, receipt.negativeEvidenceRef],
      reason: `owning-plugin:${receipt.ownerPluginId}`,
      resultHash: hashLogValue(receipt) as `sha256:${string}`,
    });
    this.unknownMutations.delete(receipt.commandId);
  }
}
