import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserMutationIntentJournal, BrowserMutationJournalEntry } from "./browser-mutation-intent-journal.js";

export type BrowserGovernedCommand =
  | Readonly<{ kind: "navigate"; url: string; title: string }>
  | Readonly<{ kind: "dom-intent"; intent: BrowserDomIntent }>
  | Readonly<{ kind: "observe"; capabilityId: import("../protocol/generated/browser-protocol.generated.js").BrowserCapabilityId }>
  | Readonly<{ kind: "screenshot"; regionLabel: string }>
  | Readonly<{ kind: "file-input"; selector: string; grantRefs: readonly string[] }>
  | Readonly<{ kind: "wait"; durationMs: number }>
  | Readonly<{ kind: "close-target"; reason: string }>;

export type BrowserCommandPort = Readonly<{
  send(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<BrowserCommandReply>;
}>;

export type BrowserCommandReply = Readonly<{
  replyChannelToken: string;
  sequence: number;
  result: unknown;
}>;

export type BrowserCommandAuthorityGuard = Readonly<{
  assertCurrentAuthority(permit: BrowserCommandPermit): void;
}>;

type MutationJournalBase = Omit<BrowserMutationJournalEntry, "recordedAt" | "reason" | "state">;
type DispatchState = { sent: boolean };

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
      authorityCertificateHash: permit.certificateHash,
      executionFenceHash: permit.executionBindingHash,
      mutationClass: "mutation",
      payloadHash: `sha256:${createHash("sha256").update(JSON.stringify(command)).digest("hex")}`,
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
  if (reply.replyChannelToken !== permit.replyChannelToken || reply.sequence !== permit.sequence) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const failureCode = (entry: MutationJournalBase | null, sent: boolean): "BROWSER_HOST_UNAVAILABLE" | "BROWSER_OUTCOME_UNKNOWN" =>
  entry !== null && sent ? "BROWSER_OUTCOME_UNKNOWN" : "BROWSER_HOST_UNAVAILABLE";

export class BrowserCommandActor {
  public constructor(
    private readonly budget: BrowserCommandAdmissionBudget,
    private readonly port: BrowserCommandPort,
    private readonly journal: BrowserMutationIntentJournal,
    private readonly authorityGuard: BrowserCommandAuthorityGuard,
  ) {}

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    assertAcceptedCommand(permit, command);
    this.authorityGuard.assertCurrentAuthority(permit);
    this.budget.enter();
    const journalEntry = createMutationJournalBase(permit, command);
    const dispatch: DispatchState = { sent: false };
    try {
      return await this.dispatch(permit, command, journalEntry, dispatch);
    } catch (error) {
      await recordMutation(this.journal, journalEntry, dispatch.sent ? "OUTCOME_UNKNOWN" : "FAILED", error instanceof Error ? error.message : "unknown");
      throw new Error(failureCode(journalEntry, dispatch.sent), { cause: error });
    } finally {
      this.budget.leave();
    }
  }

  private async dispatch(
    permit: BrowserCommandPermit,
    command: BrowserGovernedCommand,
    journalEntry: MutationJournalBase | null,
    dispatch: DispatchState,
  ): Promise<unknown> {
    await recordMutation(this.journal, journalEntry, "PREPARED");
    this.authorityGuard.assertCurrentAuthority(permit);
    await recordMutation(this.journal, journalEntry, "SENT");
    dispatch.sent = true;
    const reply = await this.port.send(permit, command);
    assertMatchingReply(permit, reply);
    this.authorityGuard.assertCurrentAuthority(permit);
    await recordMutation(this.journal, journalEntry, "CONFIRMED");
    return reply.result;
  }
}
