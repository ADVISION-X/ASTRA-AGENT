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
    postconditionVerified?: boolean;
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

const hashPattern = /^sha256:[a-f0-9]{64}$/u;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const keys = Object.keys(value).sort();
  const allowed = [...required, ...optional].sort();
  return required.every((key) => Object.hasOwn(value, key))
    && keys.every((key) => allowed.includes(key));
};
const validText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const validHash = (value: unknown): value is `sha256:${string}` => typeof value === "string" && hashPattern.test(value);
const validTimestamp = (value: unknown): value is string => validText(value) && Number.isFinite(Date.parse(value));
const validInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const validPositiveInteger = (value: unknown): value is number => validInteger(value) && value >= 1;

const assertEvent = (raw: unknown): BrowserProofEvent => {
  if (!isRecord(raw) || !validText(raw.eventType)) throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  if (raw.eventType === "LIFECYCLE") {
    const base = ["eventType", "phase", "candidateHash", "extensionId", "releaseBuildId", "recordedAt"];
    const phaseKeys = raw.phase === "AUTHENTICATED"
      ? { required: [...base, "authorityRefHash"], optional: [] }
      : raw.phase === "TARGET_CLAIMED"
        ? { required: [...base, "authorityRefHash", "targetRef", "documentRef"], optional: [] }
        : raw.phase === "TARGET_REVOKED"
          ? { required: [...base, "authorityRefHash", "targetRef"], optional: [] }
          : raw.phase === "AUTHORITY_REVOKED"
            ? { required: [...base, "reason"], optional: ["authorityRefHash"] }
            : null;
    if (!phaseKeys || !exactKeys(raw, phaseKeys.required, phaseKeys.optional)
      || !validHash(raw.candidateHash) || !validText(raw.extensionId)
      || !validText(raw.releaseBuildId) || !validTimestamp(raw.recordedAt)
      || (raw.authorityRefHash !== undefined && !validHash(raw.authorityRefHash))
      || (raw.targetRef !== undefined && !validText(raw.targetRef))
      || (raw.documentRef !== undefined && !validText(raw.documentRef))
      || (raw.reason !== undefined && !validText(raw.reason))) {
      throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
    }
    return raw as BrowserProofLifecycleEvent;
  }
  const required = ["eventType", "phase", "commandId", "actionId", "commandKind", "workspaceRef", "authorityRef", "authorityCertificateHash", "executionBindingHash", "executionFenceHash", "candidateHash", "contractManifestHash", "ownerPluginId", "jobId", "attemptId", "deviceId", "leaseVersion", "localOrderId", "targetRef", "documentRef", "commandTtlMs", "commandClass", "payloadHash", "artifactRefs", "recordedAt"];
  const phaseKeys = raw.phase === "PREPARED" || raw.phase === "SEND"
    ? { required, optional: ["domIntentKind"] }
    : raw.phase === "COMPLETED"
      ? { required: [...required, "resultHash", "transportSequence", "permitSequence"], optional: ["domIntentKind", "resultSummary"] }
      : raw.phase === "CONFIRMED"
        ? { required: [...required, "resultHash", "reason"], optional: ["domIntentKind"] }
        : raw.phase === "FAILED"
          ? { required: [...required, "reason"], optional: ["domIntentKind", "resultHash"] }
          : raw.phase === "UNKNOWN"
            ? { required: [...required, "reason"], optional: ["domIntentKind", "resultHash", "resultSummary", "transportSequence", "permitSequence"] }
            : null;
  const hashFields = ["authorityCertificateHash", "executionBindingHash", "executionFenceHash", "candidateHash", "contractManifestHash", "payloadHash"];
  const textFields = ["commandId", "actionId", "commandKind", "workspaceRef", "authorityRef", "ownerPluginId", "jobId", "attemptId", "deviceId", "localOrderId", "targetRef", "documentRef"];
  const summary = raw.resultSummary;
  const unknownHasTransportResult = raw.phase !== "UNKNOWN"
    || [raw.resultHash, raw.transportSequence, raw.permitSequence].every((value) => value !== undefined)
    || [raw.resultHash, raw.resultSummary, raw.transportSequence, raw.permitSequence].every((value) => value === undefined);
  if (!phaseKeys || !exactKeys(raw, phaseKeys.required, phaseKeys.optional)
    || raw.eventType !== "COMMAND"
    || !["observation", "mutation", "lifecycle"].includes(raw.commandClass as string)
    || hashFields.some((field) => !validHash(raw[field])) || textFields.some((field) => !validText(raw[field]))
    || !validPositiveInteger(raw.leaseVersion) || !validPositiveInteger(raw.commandTtlMs) || !validTimestamp(raw.recordedAt)
    || !Array.isArray(raw.artifactRefs) || raw.artifactRefs.some((value) => !validText(value))
    || (raw.domIntentKind !== undefined && !validText(raw.domIntentKind))
    || (raw.resultHash !== undefined && !validHash(raw.resultHash))
    || (raw.transportSequence !== undefined && !validPositiveInteger(raw.transportSequence))
    || (raw.permitSequence !== undefined && !validPositiveInteger(raw.permitSequence))
    || (raw.reason !== undefined && !validText(raw.reason))
    || !unknownHasTransportResult
    || (summary !== undefined && (!isRecord(summary) || !exactKeys(summary, ["candidateCount", "identityRevalidated", "mutationCount"], ["retainedValueVerified", "postconditionVerified"])
      || !validInteger(summary.candidateCount) || typeof summary.identityRevalidated !== "boolean" || !validInteger(summary.mutationCount)
      || (summary.retainedValueVerified !== undefined && typeof summary.retainedValueVerified !== "boolean")
      || (summary.postconditionVerified !== undefined && typeof summary.postconditionVerified !== "boolean")))) {
    throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  }
  return raw as BrowserProofCommandEvent;
};

const assertEnvelope = (
  raw: unknown,
  previousEntryHash: `sha256:${string}`,
  sequence: number,
): BrowserProofEnvelope => {
  if (!isRecord(raw)
    || !exactKeys(raw, ["schemaVersion", "sequence", "previousEntryHash", "event", "entryHash"])) {
    throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  }
  const envelope = raw as BrowserProofEnvelope;
  const event = assertEvent(envelope.event);
  if (envelope.schemaVersion !== "grasseye.browser-proof-journal.v1"
    || envelope.sequence !== sequence
    || !validHash(envelope.previousEntryHash)
    || envelope.previousEntryHash !== previousEntryHash
    || !validHash(envelope.entryHash)
    || envelope.entryHash !== digest({
      schemaVersion: envelope.schemaVersion,
      sequence: envelope.sequence,
      previousEntryHash: envelope.previousEntryHash,
      event,
    })) throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  return { ...envelope, event };
};

export const readBrowserProofJournal = (journalPath: string): readonly BrowserProofEnvelope[] => {
  if (!existsSync(journalPath)) return Object.freeze([]);
  const contents = readFileSync(journalPath, "utf8");
  if (contents.length === 0) return Object.freeze([]);
  if (!contents.endsWith("\n")) throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  const lines = contents.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0)) {
    throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
  }
  const envelopes: BrowserProofEnvelope[] = [];
  let previousEntryHash: `sha256:${string}` = zeroHash;
  lines.forEach((line, index) => {
    let envelope: BrowserProofEnvelope;
    try {
      envelope = assertEnvelope(JSON.parse(line), previousEntryHash, index + 1);
    } catch {
      throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
    }
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
    private readonly assertWriteAuthority: () => void,
  ) {
    this.assertWriteAuthority();
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
    this.assertWriteAuthority();
    const sequence = this.sequence + 1;
    const checkedEvent = assertEvent(event);
    const core = {
      schemaVersion: "grasseye.browser-proof-journal.v1" as const,
      sequence,
      previousEntryHash: this.previousEntryHash,
      event: checkedEvent,
    };
    const envelope: BrowserProofEnvelope = { ...core, entryHash: digest(core) };
    appendDurably(this.journalPath, `${JSON.stringify(envelope)}\n`);
    this.sequence = sequence;
    this.previousEntryHash = envelope.entryHash;
  }
}
