import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { assertValidCommandPermit } from "../transport/command-permit.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { assertBrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserMutationIntentJournal } from "./browser-mutation-intent-journal.js";

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

export class BrowserCommandActor {
  public constructor(
    private readonly budget: BrowserCommandAdmissionBudget,
    private readonly port: BrowserCommandPort,
    private readonly journal: BrowserMutationIntentJournal,
    private readonly authorityGuard: BrowserCommandAuthorityGuard,
  ) {}

  public async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {
    assertValidCommandPermit(permit);
    if (command.kind === "dom-intent") assertBrowserDomIntent(command.intent);
    this.authorityGuard.assertCurrentAuthority(permit);
    this.budget.enter();
    const mutation = command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "fill") || command.kind === "file-input";
    const journalEntry = mutation ? {
      commandId: permit.commandId,
      authorityCertificateHash: permit.certificateHash,
      executionFenceHash: permit.executionBindingHash,
      mutationClass: "mutation" as const,
      payloadHash: `sha256:${createHash("sha256").update(JSON.stringify(command)).digest("hex")}` as const,
    } : null;
    let sent = false;
    try {
      if (journalEntry) await this.journal.record({ ...journalEntry, state: "PREPARED", recordedAt: new Date().toISOString() });
      this.authorityGuard.assertCurrentAuthority(permit);
      if (journalEntry) await this.journal.record({ ...journalEntry, state: "SENT", recordedAt: new Date().toISOString() });
      sent = true;
      const reply = await this.port.send(permit, command);
      if (reply.replyChannelToken !== permit.replyChannelToken || reply.sequence !== permit.sequence) {
        throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      }
      this.authorityGuard.assertCurrentAuthority(permit);
      if (journalEntry) await this.journal.record({ ...journalEntry, state: "CONFIRMED", recordedAt: new Date().toISOString() });
      return reply.result;
    } catch (error) {
      if (journalEntry) await this.journal.record({
        ...journalEntry,
        state: sent ? "OUTCOME_UNKNOWN" : "FAILED",
        recordedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : "unknown",
      });
      throw new Error(mutation && sent ? "BROWSER_OUTCOME_UNKNOWN" : "BROWSER_HOST_UNAVAILABLE", { cause: error });
    } finally {
      this.budget.leave();
    }
  }
}
