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

const inspectLegacyJournal = (bytes: Buffer): Readonly<{
  firstInvalidLine: number;
  originalLineCount: number;
  observedCandidateHashes: readonly `sha256:${string}`[];
  observedReleaseBuildIds: readonly string[];
}> => {
  const contents = bytes.toString("utf8");
  const physicalLines = contents.length === 0 ? [] : contents.split("\n");
  if (physicalLines.at(-1) === "") physicalLines.pop();
  const originalLineCount = Math.max(physicalLines.length, 1);
  const candidates = new Set<`sha256:${string}`>();
  const releaseBuildIds = new Set<string>();
  let previous = `sha256:${"0".repeat(64)}`;
  let firstInvalidLine = physicalLines.length + 1;
  for (const [index, line] of physicalLines.entries()) {
    let raw: Record<string, unknown>;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      raw = parsed as Record<string, unknown>;
    } catch {
      firstInvalidLine = Math.min(firstInvalidLine, index + 1);
      break;
    }
    const event = raw.event && typeof raw.event === "object" && !Array.isArray(raw.event)
      ? raw.event as Record<string, unknown>
      : {};
    if (typeof event.candidateHash === "string" && hashPattern.test(event.candidateHash)) {
      candidates.add(event.candidateHash as `sha256:${string}`);
    }
    if (typeof event.releaseBuildId === "string" && event.releaseBuildId.length > 0) {
      releaseBuildIds.add(event.releaseBuildId);
    }
    const core = {
      schemaVersion: raw.schemaVersion,
      sequence: raw.sequence,
      previousEntryHash: raw.previousEntryHash,
      event: raw.event,
    };
    if ((raw.schemaVersion !== "grasseye.browser-proof-journal.v1"
        && raw.schemaVersion !== "grasseye.browser-proof-journal.v2")
      || raw.sequence !== index + 1
      || raw.previousEntryHash !== previous
      || raw.entryHash !== entryHash(core)) {
      firstInvalidLine = Math.min(firstInvalidLine, index + 1);
      break;
    }
    previous = String(raw.entryHash);
  }
  if (!contents.endsWith("\n")) firstInvalidLine = Math.min(firstInvalidLine, originalLineCount);
  return {
    firstInvalidLine: Math.min(firstInvalidLine, originalLineCount),
    originalLineCount,
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

export const recoverBrowserProofJournal = (
  input: BrowserProofJournalRecoveryInput,
): BrowserProofJournalRecoveryResult => {
  if (process.env[RECOVERY_AUTHORIZATION_ENV] !== "1") {
    throw new Error("BROWSER_JOURNAL_RECOVERY_NOT_AUTHORIZED");
  }
  input.assertExclusiveOwner();
  const journalPath = resolve(input.journalPath);
  const operatorId = exactText(input.operatorId, "operatorId");
  const authorizationRef = exactText(input.authorizationRef, "authorizationRef");
  const reasonCode = exactText(input.reasonCode, "reasonCode");

  try {
    const current = readBrowserProofJournal(journalPath);
    const recovery = current[0]?.event;
    if (recovery?.eventType !== "RECOVERY") throw new Error("BROWSER_JOURNAL_RECOVERY_NOT_REQUIRED");
    if (recovery.operatorId !== operatorId
      || recovery.authorizationRef !== authorizationRef
      || recovery.reasonCode !== reasonCode) {
      throw new Error("BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT");
    }
    return resultFromRecoveryEvent(recovery, "ALREADY_RECOVERED");
  } catch (error) {
    if (error instanceof Error && error.message !== INTEGRITY_FAILURE) throw error;
  }

  assertSecureRegularFile(journalPath);
  const original = readFileSync(journalPath);
  if (original.byteLength === 0) throw new Error("BROWSER_JOURNAL_RECOVERY_NOT_REQUIRED");
  const originalJournalSha256 = sha256(original);
  const diagnosis = inspectLegacyJournal(original);
  const recoveryId = sha256(JSON.stringify(canonicalize({
    schemaVersion: "grasseye.browser-proof-journal-recovery-id.v1",
    originalJournalSha256,
    operatorId,
    authorizationRef,
    reasonCode,
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

  let receipt: RecoveryReceipt;
  if (existsSync(recoveryReceiptPath)) {
    receipt = parseReceipt(recoveryReceiptPath);
    if (receipt.recoveryId !== recoveryId
      || receipt.originalJournalSha256 !== originalJournalSha256
      || receipt.archiveSha256 !== originalJournalSha256) {
      throw new Error("BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT");
    }
  } else {
    const recoveredAt = input.recoveredAt ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(recoveredAt))) throw new Error("BROWSER_JOURNAL_RECOVERY_INPUT_INVALID:recoveredAt");
    const event: BrowserProofRecoveryEvent = {
      eventType: "RECOVERY",
      phase: "GENESIS",
      recoveryId,
      originalJournalPath: journalPath,
      originalJournalSha256,
      originalByteLength: original.byteLength,
      originalLineCount: diagnosis.originalLineCount,
      firstInvalidLine: diagnosis.firstInvalidLine,
      failureCode: INTEGRITY_FAILURE,
      archivePath,
      recoveryReceiptPath,
      observedCandidateHashes: diagnosis.observedCandidateHashes,
      observedReleaseBuildIds: diagnosis.observedReleaseBuildIds,
      operatorId,
      authorizationRef,
      reasonCode,
      recoveredAt,
      recordedAt: recoveredAt,
    };
    receipt = {
      schemaVersion: "grasseye.browser-proof-journal-recovery-receipt.v1",
      recoveryId,
      originalJournalSha256,
      archiveSha256: originalJournalSha256,
      genesisEnvelope: createBrowserRecoveryEnvelope(event),
    };
    ensureExactSealedFile(recoveryReceiptPath, Buffer.from(`${JSON.stringify(canonicalize(receipt), null, 2)}\n`, "utf8"));
  }

  const canonicalBytes = Buffer.from(`${JSON.stringify(receipt.genesisEnvelope)}\n`, "utf8");
  const temporaryPath = join(browserDirectory, `.${basename(journalPath)}.${recoveryId.slice(7)}.tmp`);
  if (existsSync(temporaryPath)) {
    if (!readFileSync(temporaryPath).equals(canonicalBytes)) {
      throw new Error("BROWSER_JOURNAL_RECOVERY_TEMP_CONFLICT");
    }
  } else {
    writeExclusiveDurable(temporaryPath, canonicalBytes);
  }
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
