import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  createBrowserRecoveryEnvelope,
  readBrowserProofJournal,
  type BrowserProofEnvelope,
  type BrowserProofRecoveryEvent,
} from "./browser-proof-journal.js";

const INTEGRITY_FAILURE = "BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID" as const;
const RECOVERY_AUTHORIZATION_ENV = "GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED";
const hashPattern = /^sha256:[a-f0-9]{64}$/u;

type RecoveryReceipt = Readonly<{
  schemaVersion: "grasseye.browser-proof-journal-recovery-receipt.v1";
  recoveryId: `sha256:${string}`;
  originalJournalSha256: `sha256:${string}`;
  archiveSha256: `sha256:${string}`;
  genesisEnvelope: BrowserProofEnvelope;
}>;

export type BrowserProofJournalRecoveryInput = Readonly<{
  journalPath: string;
  operatorId: string;
  authorizationRef: string;
  reasonCode: string;
  assertExclusiveOwner: () => void;
  recoveredAt?: string;
}>;

export type BrowserProofJournalRecoveryResult = Readonly<{
  status: "RECOVERED" | "ALREADY_RECOVERED";
  recoveryId: `sha256:${string}`;
  archivePath: string;
  recoveryReceiptPath: string;
  originalJournalSha256: `sha256:${string}`;
  firstInvalidLine: number;
}>;

const canonicalize = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]))
    : value;
const sha256 = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const entryHash = (value: unknown): `sha256:${string}` => sha256(JSON.stringify(canonicalize(value)));
const exactText = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 256 || /[\r\n\0]/u.test(trimmed)) {
    throw new Error(`BROWSER_JOURNAL_RECOVERY_INPUT_INVALID:${field}`);
  }
  return trimmed;
};
const fsyncDirectory = (path: string): void => {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
};
const writeExclusiveDurable = (path: string, bytes: Buffer): void => {
  const descriptor = openSync(path, "wx", 0o600);
  try {
    writeSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};
const ensureExactSealedFile = (path: string, bytes: Buffer): void => {
  if (existsSync(path)) {
    if (!readFileSync(path).equals(bytes)) throw new Error("BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT");
    return;
  }
  writeExclusiveDurable(path, bytes);
  chmodSync(path, 0o400);
  fsyncDirectory(dirname(path));
};
const assertSecureRegularFile = (path: string): void => {
  const stat = lstatSync(path);
  const ownerUid = typeof process.getuid === "function" ? process.getuid() : null;
  if (!stat.isFile() || (stat.mode & 0o077) !== 0 || (ownerUid !== null && stat.uid !== ownerUid)) {
    throw new Error("BROWSER_JOURNAL_RECOVERY_SOURCE_UNSAFE");
  }
};

type LegacyDiagnosis = Readonly<{
  firstInvalidLine: number;
  originalLineCount: number;
  containsRecoveryEvent: boolean;
  observedCandidateHashes: readonly `sha256:${string}`[];
  observedReleaseBuildIds: readonly string[];
}>;

const parseLegacyLine = (line: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const collectLegacyIdentity = (
  raw: Record<string, unknown>,
  candidates: Set<`sha256:${string}`>,
  releaseBuildIds: Set<string>,
): void => {
  const event = raw.event && typeof raw.event === "object" && !Array.isArray(raw.event)
    ? raw.event as Record<string, unknown>
    : {};
  if (typeof event.candidateHash === "string" && hashPattern.test(event.candidateHash)) {
    candidates.add(event.candidateHash as `sha256:${string}`);
  }
  if (typeof event.releaseBuildId === "string" && event.releaseBuildId.length > 0) {
    releaseBuildIds.add(event.releaseBuildId);
  }
};

const legacyEntryValid = (raw: Record<string, unknown>, index: number, previous: string): boolean => {
  const core = {
    schemaVersion: raw.schemaVersion,
    sequence: raw.sequence,
    previousEntryHash: raw.previousEntryHash,
    event: raw.event,
  };
  return ["grasseye.browser-proof-journal.v1", "grasseye.browser-proof-journal.v2"].includes(String(raw.schemaVersion))
    && raw.sequence === index + 1 && raw.previousEntryHash === previous && raw.entryHash === entryHash(core);
};

const inspectLegacyJournal = (bytes: Buffer): LegacyDiagnosis => {
  const contents = bytes.toString("utf8");
  const physicalLines = contents.length === 0 ? [] : contents.split("\n");
  if (physicalLines.at(-1) === "") physicalLines.pop();
  const originalLineCount = Math.max(physicalLines.length, 1);
  const candidates = new Set<`sha256:${string}`>();
  const releaseBuildIds = new Set<string>();
  let containsRecoveryEvent = false;
  let previous = `sha256:${"0".repeat(64)}`;
  let firstInvalidLine = physicalLines.length + 1;
  for (const [index, line] of physicalLines.entries()) {
    const raw = parseLegacyLine(line);
    if (!raw) {
      firstInvalidLine = Math.min(firstInvalidLine, index + 1);
      break;
    }
    collectLegacyIdentity(raw, candidates, releaseBuildIds);
    if (raw.event && typeof raw.event === "object" && !Array.isArray(raw.event)
      && (raw.event as Record<string, unknown>).eventType === "RECOVERY") containsRecoveryEvent = true;
    if (!legacyEntryValid(raw, index, previous)) {
      firstInvalidLine = Math.min(firstInvalidLine, index + 1);
      break;
    }
    previous = String(raw.entryHash);
  }
  if (!contents.endsWith("\n")) firstInvalidLine = Math.min(firstInvalidLine, originalLineCount);
  return {
    firstInvalidLine: Math.min(firstInvalidLine, originalLineCount),
    originalLineCount,
    containsRecoveryEvent,
    observedCandidateHashes: [...candidates].sort(),
    observedReleaseBuildIds: [...releaseBuildIds].sort(),
  };
};

const parseReceipt = (path: string): RecoveryReceipt => {
  const receipt = JSON.parse(readFileSync(path, "utf8")) as RecoveryReceipt;
  if (receipt.schemaVersion !== "grasseye.browser-proof-journal-recovery-receipt.v1"
    || !hashPattern.test(receipt.recoveryId)
    || !hashPattern.test(receipt.originalJournalSha256)
    || !hashPattern.test(receipt.archiveSha256)) {
    throw new Error("BROWSER_JOURNAL_RECOVERY_RECEIPT_INVALID");
  }
  return receipt;
};

const resultFromRecoveryEvent = (
  event: BrowserProofRecoveryEvent,
  status: BrowserProofJournalRecoveryResult["status"],
): BrowserProofJournalRecoveryResult => ({
  status,
  recoveryId: event.recoveryId,
  archivePath: event.archivePath,
  recoveryReceiptPath: event.recoveryReceiptPath,
  originalJournalSha256: event.originalJournalSha256,
  firstInvalidLine: event.firstInvalidLine,
});

type RecoveryIdentity = Readonly<{
  operatorId: string;
  authorizationRef: string;
  reasonCode: string;
}>;
type RecoveryMaterial = Readonly<{
  journalPath: string;
  browserDirectory: string;
  original: Buffer;
  originalJournalSha256: `sha256:${string}`;
  diagnosis: LegacyDiagnosis;
  recoveryId: `sha256:${string}`;
  archivePath: string;
  recoveryReceiptPath: string;
}>;

const existingRecovery = (
  journalPath: string,
  identity: RecoveryIdentity,
): BrowserProofJournalRecoveryResult | null => {
  try {
    const recovery = readBrowserProofJournal(journalPath)[0]?.event;
    if (recovery?.eventType !== "RECOVERY") throw new Error("BROWSER_JOURNAL_RECOVERY_NOT_REQUIRED");
    if (recovery.operatorId !== identity.operatorId || recovery.authorizationRef !== identity.authorizationRef
      || recovery.reasonCode !== identity.reasonCode) throw new Error("BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT");
    return resultFromRecoveryEvent(recovery, "ALREADY_RECOVERED");
  } catch (error) {
    if (error instanceof Error && error.message !== INTEGRITY_FAILURE) throw error;
    return null;
  }
};

const prepareRecoveryMaterial = (journalPath: string, identity: RecoveryIdentity): RecoveryMaterial => {
  assertSecureRegularFile(journalPath);
  const original = readFileSync(journalPath);
  if (original.byteLength === 0) throw new Error("BROWSER_JOURNAL_RECOVERY_NOT_REQUIRED");
  const originalJournalSha256 = sha256(original);
  const diagnosis = inspectLegacyJournal(original);
  if (diagnosis.containsRecoveryEvent) throw new Error("BROWSER_JOURNAL_RECOVERY_SECOND_GENESIS_FORBIDDEN");
  const recoveryId = sha256(JSON.stringify(canonicalize({
    schemaVersion: "grasseye.browser-proof-journal-recovery-id.v1",
    originalJournalSha256,
    ...identity,
  })));
  const browserDirectory = dirname(journalPath);
  const archiveDirectory = join(browserDirectory, "archive");
  const receiptDirectory = join(browserDirectory, "recovery-receipts");
  mkdirSync(archiveDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
  const digestName = originalJournalSha256.slice("sha256:".length);
  const archivePath = resolve(archiveDirectory, `${basename(journalPath)}.${digestName}.sealed`);
  const recoveryReceiptPath = resolve(receiptDirectory, `${recoveryId.slice("sha256:".length)}.json`);
  ensureExactSealedFile(archivePath, original);
  if (sha256(readFileSync(archivePath)) !== originalJournalSha256) {
    throw new Error("BROWSER_JOURNAL_RECOVERY_ARCHIVE_HASH_MISMATCH");
  }
  return { journalPath, browserDirectory, original, originalJournalSha256, diagnosis, recoveryId, archivePath, recoveryReceiptPath };
};

const createRecoveryReceipt = (
  input: BrowserProofJournalRecoveryInput,
  identity: RecoveryIdentity,
  material: RecoveryMaterial,
): RecoveryReceipt => {
  const recoveredAt = input.recoveredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(recoveredAt))) throw new Error("BROWSER_JOURNAL_RECOVERY_INPUT_INVALID:recoveredAt");
  const event: BrowserProofRecoveryEvent = {
    eventType: "RECOVERY", phase: "GENESIS", recoveryId: material.recoveryId,
    originalJournalPath: material.journalPath, originalJournalSha256: material.originalJournalSha256,
    originalByteLength: material.original.byteLength, originalLineCount: material.diagnosis.originalLineCount,
    firstInvalidLine: material.diagnosis.firstInvalidLine, failureCode: INTEGRITY_FAILURE,
    archivePath: material.archivePath, recoveryReceiptPath: material.recoveryReceiptPath,
    observedCandidateHashes: material.diagnosis.observedCandidateHashes,
    observedReleaseBuildIds: material.diagnosis.observedReleaseBuildIds,
    ...identity, recoveredAt, recordedAt: recoveredAt,
  };
  return {
    schemaVersion: "grasseye.browser-proof-journal-recovery-receipt.v1",
    recoveryId: material.recoveryId,
    originalJournalSha256: material.originalJournalSha256,
    archiveSha256: material.originalJournalSha256,
    genesisEnvelope: createBrowserRecoveryEnvelope(event),
  };
};

const receiptForRecovery = (
  input: BrowserProofJournalRecoveryInput,
  identity: RecoveryIdentity,
  material: RecoveryMaterial,
): RecoveryReceipt => {
  if (!existsSync(material.recoveryReceiptPath)) {
    const receipt = createRecoveryReceipt(input, identity, material);
    ensureExactSealedFile(material.recoveryReceiptPath, Buffer.from(`${JSON.stringify(canonicalize(receipt), null, 2)}\n`, "utf8"));
    return receipt;
  }
  const receipt = parseReceipt(material.recoveryReceiptPath);
  if (receipt.recoveryId !== material.recoveryId
    || receipt.originalJournalSha256 !== material.originalJournalSha256
    || receipt.archiveSha256 !== material.originalJournalSha256) {
    throw new Error("BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT");
  }
  return receipt;
};

const commitRecovery = (material: RecoveryMaterial, receipt: RecoveryReceipt): BrowserProofJournalRecoveryResult => {
  const { browserDirectory, journalPath, original, recoveryId } = material;
  const canonicalBytes = Buffer.from(`${JSON.stringify(receipt.genesisEnvelope)}\n`, "utf8");
  const temporaryPath = join(browserDirectory, `.${basename(journalPath)}.${recoveryId.slice(7)}.tmp`);
  if (existsSync(temporaryPath)) {
    if (!readFileSync(temporaryPath).equals(canonicalBytes)) throw new Error("BROWSER_JOURNAL_RECOVERY_TEMP_CONFLICT");
  } else writeExclusiveDurable(temporaryPath, canonicalBytes);
  if (!readFileSync(journalPath).equals(original)) throw new Error("BROWSER_JOURNAL_RECOVERY_SOURCE_DRIFT");
  renameSync(temporaryPath, journalPath);
  chmodSync(journalPath, 0o600);
  fsyncDirectory(browserDirectory);
  const recovered = readBrowserProofJournal(journalPath);
  const recovery = recovered[0]?.event;
  if (recovered.length !== 1 || recovery?.eventType !== "RECOVERY" || recovery.recoveryId !== recoveryId) {
    throw new Error("BROWSER_JOURNAL_RECOVERY_COMMIT_INVALID");
  }
  return resultFromRecoveryEvent(recovery, "RECOVERED");
};

export const recoverBrowserProofJournal = (
  input: BrowserProofJournalRecoveryInput,
): BrowserProofJournalRecoveryResult => {
  if (process.env[RECOVERY_AUTHORIZATION_ENV] !== "1") {
    throw new Error("BROWSER_JOURNAL_RECOVERY_NOT_AUTHORIZED");
  }
  input.assertExclusiveOwner();
  const journalPath = resolve(input.journalPath);
  const identity: RecoveryIdentity = {
    operatorId: exactText(input.operatorId, "operatorId"),
    authorizationRef: exactText(input.authorizationRef, "authorizationRef"),
    reasonCode: exactText(input.reasonCode, "reasonCode"),
  };
  const existing = existingRecovery(journalPath, identity);
  if (existing) return existing;
  const material = prepareRecoveryMaterial(journalPath, identity);
  return commitRecovery(material, receiptForRecovery(input, identity, material));
};
