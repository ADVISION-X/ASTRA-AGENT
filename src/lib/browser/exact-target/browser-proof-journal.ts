import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
  fsyncSync,
} from "node:fs";
import { dirname } from "node:path";

export type BrowserProofCommandPhase =
  | "PREPARED" | "SEND" | "COMPLETED" | "CONFIRMED" | "FAILED" | "UNKNOWN";

export type BrowserProofCommandEvent = Readonly<{
  eventType: "COMMAND";
  phase: BrowserProofCommandPhase;
  commandId: string;
  actionId: string;
  commandKind: string;
  domIntentKind?: string;
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
  commandClass: "observation" | "mutation" | "lifecycle";
  payloadHash: `sha256:${string}`;
  artifactRefs: readonly string[];
  resultHash?: `sha256:${string}`;
  resultSummary?: Readonly<{
    candidateCount: number;
    identityRevalidated: boolean;
    mutationCount: number;
    retainedValueVerified?: boolean;
  }>;
  transportSequence?: number;
  permitSequence?: number;
  recordedAt: string;
  reason?: string;
}>;

export type BrowserProofLifecycleEvent = Readonly<{
  eventType: "LIFECYCLE";
  phase: "AUTHENTICATED" | "TARGET_CLAIMED" | "TARGET_REVOKED" | "AUTHORITY_REVOKED";
  candidateHash: `sha256:${string}`;
  extensionId: string;
  releaseBuildId: string;
  recordedAt: string;
  authorityRefHash?: `sha256:${string}`;
  targetRef?: string;
  documentRef?: string;
  reason?: string;
}>;

export type BrowserProofEvent = BrowserProofCommandEvent | BrowserProofLifecycleEvent;
export type BrowserProofEnvelope = Readonly<{
  schemaVersion: "grasseye.browser-proof-journal.v1";
  sequence: number;
  previousEntryHash: `sha256:${string}`;
  event: BrowserProofEvent;
  entryHash: `sha256:${string}`;
}>;

const zeroHash = `sha256:${"0".repeat(64)}` as const;
const canonicalize = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]))
    : value;

const digest = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;

const assertEnvelope = (
  raw: unknown,
  previousEntryHash: `sha256:${string}`,
  sequence: number,
): BrowserProofEnvelope => {
  const envelope = raw as BrowserProofEnvelope;
  if (envelope.schemaVersion !== "grasseye.browser-proof-journal.v1"
    || envelope.sequence !== sequence
    || envelope.previousEntryHash !== previousEntryHash
    || envelope.entryHash !== digest({
      schemaVersion: envelope.schemaVersion,
      sequence: envelope.sequence,
      previousEntryHash: envelope.previousEntryHash,
      event: envelope.event,
    })) throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  return envelope;
};

export const readBrowserProofJournal = (journalPath: string): readonly BrowserProofEnvelope[] => {
  if (!existsSync(journalPath)) return Object.freeze([]);
  const lines = readFileSync(journalPath, "utf8").split("\n").filter(Boolean);
  const envelopes: BrowserProofEnvelope[] = [];
  let previousEntryHash: `sha256:${string}` = zeroHash;
  lines.forEach((line, index) => {
    const envelope = assertEnvelope(JSON.parse(line), previousEntryHash, index + 1);
    envelopes.push(envelope);
    previousEntryHash = envelope.entryHash;
  });
  return Object.freeze(envelopes);
};

const appendDurably = (journalPath: string, line: string): void => {
  mkdirSync(dirname(journalPath), { recursive: true });
  const descriptor = openSync(journalPath, "a", 0o600);
  try {
    writeSync(descriptor, line, undefined, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

export class BrowserProofJournal {
  private sequence: number;
  private previousEntryHash: `sha256:${string}`;

  public constructor(
    private readonly journalPath: string,
    private readonly identity: Readonly<{
      candidateHash: `sha256:${string}`;
      extensionId: string;
      releaseBuildId: string;
    }>,
  ) {
    const existing = readBrowserProofJournal(journalPath);
    this.sequence = existing.length;
    this.previousEntryHash = existing.at(-1)?.entryHash ?? zeroHash;
  }

  public recordCommand(event: BrowserProofCommandEvent): void {
    this.record(event);
  }

  public recordLifecycle(
    event: Omit<BrowserProofLifecycleEvent, "candidateHash" | "extensionId" | "releaseBuildId" | "recordedAt">,
  ): void {
    this.record({
      ...event,
      ...this.identity,
      recordedAt: new Date().toISOString(),
    });
  }

  private record(event: BrowserProofEvent): void {
    const core = {
      schemaVersion: "grasseye.browser-proof-journal.v1" as const,
      sequence: ++this.sequence,
      previousEntryHash: this.previousEntryHash,
      event,
    };
    const envelope: BrowserProofEnvelope = { ...core, entryHash: digest(core) };
    appendDurably(this.journalPath, `${JSON.stringify(envelope)}\n`);
    this.previousEntryHash = envelope.entryHash;
  }
}
