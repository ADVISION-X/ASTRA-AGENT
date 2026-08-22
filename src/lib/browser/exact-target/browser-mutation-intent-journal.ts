import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type BrowserMutationJournalState = "PREPARED" | "SEND" | "CONFIRMED" | "FAILED" | "UNKNOWN";
export type BrowserMutationJournalEntry = Readonly<{
  commandId: string;
  actionId: string;
  workspaceRef: string;
  authorityRef: string;
  authorityCertificateHash: `sha256:${string}`;
  executionBindingHash: `sha256:${string}`;
  executionFenceHash: `sha256:${string}`;
  candidateHash: `sha256:${string}`;
  contractManifestHash: `sha256:${string}`;
  ownerPluginId: string;
  jobId: string;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  localOrderId: string;
  targetRef: string;
  documentRef: string;
  commandTtlMs: number;
  mutationClass: "mutation";
  payloadHash: `sha256:${string}`;
  artifactRefs: readonly string[];
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
