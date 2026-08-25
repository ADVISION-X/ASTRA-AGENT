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

export type BrowserProofRecoveryEvent = Readonly<{
  eventType: "RECOVERY";
  phase: "GENESIS";
  recordedAt: string;
  recoveryId: `sha256:${string}`;
  originalJournalPath: string;
  originalJournalSha256: `sha256:${string}`;
  originalByteLength: number;
  originalLineCount: number;
  firstInvalidLine: number;
  failureCode: "BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID";
  archivePath: string;
  recoveryReceiptPath: string;
  observedCandidateHashes: readonly `sha256:${string}`[];
  observedReleaseBuildIds: readonly string[];
  operatorId: string;
  authorizationRef: string;
  reasonCode: string;
  recoveredAt: string;
}>;

export type BrowserProofEvent = BrowserProofCommandEvent | BrowserProofLifecycleEvent | BrowserProofRecoveryEvent;
export type BrowserProofEnvelope = Readonly<{
  schemaVersion: "grasseye.browser-proof-journal.v2";
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
const validSortedUnique = (value: unknown, predicate: (item: unknown) => boolean): value is readonly unknown[] =>
  Array.isArray(value)
  && value.every(predicate)
  && value.every((item, index) => index === 0 || String(value[index - 1]!) < String(item));

const invalidJournal = (): never => {
  throw new Error("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID");
};

const lifecyclePhaseKeys = (phase: unknown): Readonly<{ required: string[]; optional: string[] }> | null => {
  const base = ["eventType", "phase", "candidateHash", "extensionId", "releaseBuildId", "recordedAt"];
  if (phase === "AUTHENTICATED") return { required: [...base, "authorityRefHash"], optional: [] };
  if (phase === "TARGET_CLAIMED") return { required: [...base, "authorityRefHash", "targetRef", "documentRef"], optional: [] };
  if (phase === "TARGET_REVOKED") return { required: [...base, "authorityRefHash", "targetRef"], optional: [] };
  return phase === "AUTHORITY_REVOKED" ? { required: [...base, "reason"], optional: ["authorityRefHash"] } : null;
};

const assertLifecycleEvent = (raw: Record<string, unknown>): BrowserProofLifecycleEvent => {
  const phaseKeys = lifecyclePhaseKeys(raw.phase);
  const invalid = !phaseKeys || !exactKeys(raw, phaseKeys.required, phaseKeys.optional)
    || !validHash(raw.candidateHash) || !validText(raw.extensionId)
    || !validText(raw.releaseBuildId) || !validTimestamp(raw.recordedAt)
    || (raw.authorityRefHash !== undefined && !validHash(raw.authorityRefHash))
    || (raw.targetRef !== undefined && !validText(raw.targetRef))
    || (raw.documentRef !== undefined && !validText(raw.documentRef))
    || (raw.reason !== undefined && !validText(raw.reason));
  return invalid ? invalidJournal() : raw as BrowserProofLifecycleEvent;
};

const commandPhaseKeys = (
  phase: unknown,
  required: string[],
): Readonly<{ required: string[]; optional: string[] }> | null => {
  if (phase === "PREPARED" || phase === "SEND") return { required, optional: ["domIntentKind"] };
  if (phase === "COMPLETED") return { required: [...required, "resultHash", "transportSequence", "permitSequence"], optional: ["domIntentKind", "resultSummary"] };
  if (phase === "CONFIRMED") return { required: [...required, "resultHash", "reason"], optional: ["domIntentKind"] };
  if (phase === "FAILED") return { required: [...required, "reason"], optional: ["domIntentKind", "resultHash"] };
  return phase === "UNKNOWN"
    ? { required: [...required, "reason"], optional: ["domIntentKind", "resultHash", "resultSummary", "transportSequence", "permitSequence"] }
    : null;
};

const validResultSummary = (value: unknown): boolean => value === undefined || (
  isRecord(value)
  && exactKeys(value, ["candidateCount", "identityRevalidated", "mutationCount"], ["retainedValueVerified", "postconditionVerified"])
  && validInteger(value.candidateCount)
  && typeof value.identityRevalidated === "boolean"
  && validInteger(value.mutationCount)
  && (value.retainedValueVerified === undefined || typeof value.retainedValueVerified === "boolean")
  && (value.postconditionVerified === undefined || typeof value.postconditionVerified === "boolean")
);

const validCommandIdentity = (raw: Record<string, unknown>): boolean => {
  const hashFields = ["authorityCertificateHash", "executionBindingHash", "executionFenceHash", "candidateHash", "contractManifestHash", "payloadHash"];
  const textFields = ["commandId", "actionId", "commandKind", "workspaceRef", "authorityRef", "ownerPluginId", "jobId", "attemptId", "deviceId", "localOrderId", "targetRef", "documentRef"];
  return hashFields.every((field) => validHash(raw[field]))
    && textFields.every((field) => validText(raw[field]));
};

const validCommandCore = (raw: Record<string, unknown>): boolean =>
  raw.eventType === "COMMAND"
  && ["observation", "mutation", "lifecycle"].includes(raw.commandClass as string)
  && validCommandIdentity(raw)
  && validPositiveInteger(raw.leaseVersion)
  && validPositiveInteger(raw.commandTtlMs)
  && validTimestamp(raw.recordedAt)
  && Array.isArray(raw.artifactRefs)
  && raw.artifactRefs.every((value) => validText(value));

const validCommandOutcome = (raw: Record<string, unknown>): boolean =>
  (raw.domIntentKind === undefined || validText(raw.domIntentKind))
  && (raw.resultHash === undefined || validHash(raw.resultHash))
  && (raw.transportSequence === undefined || validPositiveInteger(raw.transportSequence))
  && (raw.permitSequence === undefined || validPositiveInteger(raw.permitSequence))
  && (raw.reason === undefined || validText(raw.reason))
  && validResultSummary(raw.resultSummary);

const validUnknownTransportResult = (raw: Record<string, unknown>): boolean =>
  raw.phase !== "UNKNOWN"
  || [raw.resultHash, raw.transportSequence, raw.permitSequence].every((value) => value !== undefined)
  || [raw.resultHash, raw.resultSummary, raw.transportSequence, raw.permitSequence].every((value) => value === undefined);

const assertCommandEvent = (raw: Record<string, unknown>): BrowserProofCommandEvent => {
  const required = ["eventType", "phase", "commandId", "actionId", "commandKind", "workspaceRef", "authorityRef", "authorityCertificateHash", "executionBindingHash", "executionFenceHash", "candidateHash", "contractManifestHash", "ownerPluginId", "jobId", "attemptId", "deviceId", "leaseVersion", "localOrderId", "targetRef", "documentRef", "commandTtlMs", "commandClass", "payloadHash", "artifactRefs", "recordedAt"];
  const phaseKeys = commandPhaseKeys(raw.phase, required);
  const invalid = !phaseKeys || !exactKeys(raw, phaseKeys.required, phaseKeys.optional)
    || !validCommandCore(raw)
    || !validCommandOutcome(raw)
    || !validUnknownTransportResult(raw);
  return invalid ? invalidJournal() : raw as BrowserProofCommandEvent;
};

const recoveryKeys = [
  "eventType", "phase", "recoveryId", "originalJournalPath", "originalJournalSha256",
  "originalByteLength", "originalLineCount", "firstInvalidLine", "failureCode", "archivePath",
  "recoveryReceiptPath", "observedCandidateHashes", "observedReleaseBuildIds", "operatorId",
  "authorizationRef", "reasonCode", "recoveredAt", "recordedAt",
];

const recoverySourceValid = (raw: Record<string, unknown>): boolean => validHash(raw.recoveryId)
  && validText(raw.originalJournalPath) && validHash(raw.originalJournalSha256)
  && validPositiveInteger(raw.originalByteLength) && validPositiveInteger(raw.originalLineCount)
  && validPositiveInteger(raw.firstInvalidLine) && raw.firstInvalidLine <= raw.originalLineCount;

const recoveryReceiptValid = (raw: Record<string, unknown>): boolean => validText(raw.archivePath)
  && validText(raw.recoveryReceiptPath) && validSortedUnique(raw.observedCandidateHashes, validHash)
  && validSortedUnique(raw.observedReleaseBuildIds, validText);

const recoveryAuthorityValid = (raw: Record<string, unknown>): boolean => validText(raw.operatorId)
  && validText(raw.authorizationRef) && validText(raw.reasonCode)
  && validTimestamp(raw.recoveredAt) && validTimestamp(raw.recordedAt)
  && raw.recordedAt === raw.recoveredAt;

const assertRecoveryEvent = (raw: Record<string, unknown>): BrowserProofRecoveryEvent => {
  const invalid = !exactKeys(raw, recoveryKeys) || raw.eventType !== "RECOVERY" || raw.phase !== "GENESIS"
    || raw.failureCode !== "BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID"
    || !recoverySourceValid(raw) || !recoveryReceiptValid(raw) || !recoveryAuthorityValid(raw);
  return invalid ? invalidJournal() : raw as BrowserProofRecoveryEvent;
};

const assertEvent = (raw: unknown): BrowserProofEvent => {
  if (!isRecord(raw) || !validText(raw.eventType)) return invalidJournal();
  if (raw.eventType === "LIFECYCLE") return assertLifecycleEvent(raw);
  if (raw.eventType === "RECOVERY") return assertRecoveryEvent(raw);
  return assertCommandEvent(raw);
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
  if (envelope.schemaVersion !== "grasseye.browser-proof-journal.v2"
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
  if (event.eventType === "RECOVERY" && sequence !== 1) invalidJournal();
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
  const recoveryCount = envelopes.filter(({ event }) => event.eventType === "RECOVERY").length;
  if (recoveryCount > 1) invalidJournal();
  return Object.freeze(envelopes);
};

export const createBrowserRecoveryEnvelope = (event: BrowserProofRecoveryEvent): BrowserProofEnvelope => {
  const checkedEvent = assertRecoveryEvent(event);
  const core = {
    schemaVersion: "grasseye.browser-proof-journal.v2" as const,
    sequence: 1,
    previousEntryHash: zeroHash,
    event: checkedEvent,
  };
  return { ...core, entryHash: digest(core) };
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
      schemaVersion: "grasseye.browser-proof-journal.v2" as const,
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
