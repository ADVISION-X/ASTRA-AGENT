import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type BrowserMutationJournalState = "PREPARED" | "SENT" | "CONFIRMED" | "FAILED" | "OUTCOME_UNKNOWN";
export type BrowserMutationJournalEntry = Readonly<{
  commandId: string;
  authorityCertificateHash: `sha256:${string}`;
  executionFenceHash: `sha256:${string}`;
  mutationClass: "mutation";
  payloadHash: `sha256:${string}`;
  state: BrowserMutationJournalState;
  recordedAt: string;
  reason?: string;
}>;

export class BrowserMutationIntentJournal {
  public constructor(private readonly journalPath: string) {}

  public async record(entry: BrowserMutationJournalEntry): Promise<void> {
    await mkdir(dirname(this.journalPath), { recursive: true });
    await appendFile(this.journalPath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flush: true });
  }
}
