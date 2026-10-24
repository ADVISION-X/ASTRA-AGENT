import type { BrowserDomObservationQuery } from "./browser-dom-intent.js";
import { GPT_WEB_ORIGIN } from "./browser-site-policy-registry.js";

export const GPT_CONVERSATION_SEGMENT_MAX_CHARS = 256;
export const sanitizeCurrentUrl = (value: string): string => {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("BROWSER_DOM_READ_INVALID"); }
  const segments = url.pathname.split("/");
  const root = url.pathname === "/";
  const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
    && segments[2]!.length > 0 && segments[2]!.length <= GPT_CONVERSATION_SEGMENT_MAX_CHARS;
  if (url.protocol !== "https:" || url.origin !== GPT_WEB_ORIGIN || url.username !== "" || url.password !== ""
    || (!root && !conversation) || url.search !== "" || url.hash !== "") {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return `${url.origin}${url.pathname}`;
};


import type { BrowserMutationIdentity } from "./browser-mutation-types.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import { knownGptRateLimitPreflightFactShapeValid } from "./browser-gpt-rate-limit-preflight.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";
import {
  browserPostconditionNativeCause,
  type BrowserPostconditionBaseCause,
} from "./browser-interaction-native-cause.js";

const exactKeys = (value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
};

const coherentPacketHeaderValid = (
  packet: Readonly<Record<string, unknown>>,
  queryCount: number,
): boolean => exactKeys(packet, ["schemaVersion", "exactCallIdentityHash", "targetRefHash", "documentRefHash",
  "currentUrl", "observationRevisionHash", "observedAt", "queries"])
  && packet.schemaVersion === "grasseye.browser.dom-observation.v2"
  && [packet.exactCallIdentityHash, packet.targetRefHash, packet.documentRefHash,
    packet.observationRevisionHash].every((hash) => typeof hash === "string"
    && /^sha256:[a-f0-9]{64}$/u.test(hash))
  && Array.isArray(packet.queries) && packet.queries.length === queryCount;

const coherentRowShapeValid = (
  row: Readonly<Record<string, unknown>>,
  queryId: string,
): boolean => row.queryId === queryId
  && Number.isSafeInteger(row.rawCount) && Number.isSafeInteger(row.eligibleCount)
  && (row.rawCount as number) >= 0 && (row.eligibleCount as number) >= 0
  && (row.eligibleCount as number) <= (row.rawCount as number) && Array.isArray(row.rejections);

const coherentRowResult = (
  candidate: unknown,
  spec: Readonly<{ queryId: string; expectedEligibleCount: number }>,
  queryIndex: number,
): Readonly<{ valid: boolean; cause: string | null }> => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { valid: false, cause: null };
  }
  const row = candidate as Readonly<Record<string, unknown>>;
  if (!coherentRowShapeValid(row, spec.queryId)) return { valid: false, cause: null };
  if (row.eligibleCount === spec.expectedEligibleCount) return { valid: true, cause: null };
  const first = (row.rejections as readonly unknown[])[0];
  const reasons = first && typeof first === "object" && !Array.isArray(first)
    ? (first as Readonly<Record<string, unknown>>).reasons : undefined;
  const firstReason = Array.isArray(reasons) && typeof reasons[0] === "string" ? reasons[0] : null;
  const baseCause: BrowserPostconditionBaseCause = (row.eligibleCount as number) > spec.expectedEligibleCount
    ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS"
    : (firstReason as BrowserPostconditionBaseCause | null) ?? "BROWSER_DOM_CANDIDATE_MISSING";
  return { valid: true,
    cause: browserPostconditionNativeCause(queryIndex, baseCause) };
};

const postconditionPacket = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
) => {
  if (command.kind !== "dom-intent" || command.intent.kind !== "click") return null;
  if (command.intent.postClickObservation === undefined) return null;
  const packet = value.postconditionObservation;
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return null;
  return { postcondition: command.intent.postClickObservation,
    packet: packet as Readonly<Record<string, unknown>> };
};

const exactOutgoingPostconditionVerified = (
  expectedPromptHash: string | undefined,
  packet: Readonly<Record<string, unknown>>,
): boolean => {
  if (expectedPromptHash === undefined) return true;
  const rows = packet.queries;
  if (!Array.isArray(rows)) return false;
  const row = rows[0] as Readonly<Record<string, unknown>> | undefined;
  const message = Array.isArray(row?.matches) ? row.matches[0] : null;
  return message !== null && typeof message === "object" && !Array.isArray(message)
    && (message as Readonly<Record<string, unknown>>).exactGptUserPromptHash === expectedPromptHash;
};

export const browserObservationPostconditionDecision = (
  specs: readonly Readonly<{ queryId: string; expectedEligibleCount: number }>[],
  packet: Readonly<Record<string, unknown>>,
  expectedPromptHash?: string,
): Readonly<{ valid: boolean; verified: boolean; nativeCauseCode: string | null }> => {
  const invalid = { valid: false, verified: false, nativeCauseCode: null };
  try {
    if (typeof packet.currentUrl !== "string" || sanitizeCurrentUrl(packet.currentUrl) !== packet.currentUrl
      || !Array.isArray(packet.queries) || packet.queries.length !== specs.length) return invalid;
    const rows = packet.queries.map((candidate, index) => coherentRowResult(candidate, specs[index]!, index));
    if (!rows.every(row => row.valid)) return invalid;
    const queryCause = rows.find(row => row.cause !== null)?.cause ?? null;
    const nativeCauseCode = queryCause ?? (exactOutgoingPostconditionVerified(expectedPromptHash, packet)
      ? null : "BROWSER_DOM_CANDIDATE_MISSING");
    return { valid: true, verified: nativeCauseCode === null, nativeCauseCode };
  } catch { return invalid; }
};

export const observationPostconditionEvidenceValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => {
  const observed = postconditionPacket(command, value);
  if (!observed) return false;
  const { postcondition, packet } = observed;
  if (!coherentPacketHeaderValid(packet, postcondition.queries.length)) return false;
  const expectedHash = command.kind === "dom-intent" && command.intent.kind === "click"
    ? command.intent.preClickExactOutgoingTurn?.expectedPromptHash : undefined;
  const decision = browserObservationPostconditionDecision(postcondition.queries, packet, expectedHash);
  return decision.valid && value.postconditionVerified === decision.verified
    && (decision.verified ? value.nativeCauseCode === undefined : value.nativeCauseCode === decision.nativeCauseCode);
};

export type BrowserMutationTerminalReceipt = Readonly<{
  schemaVersion: "grasseye.browser.command-terminal-receipt.v1";
  terminal: "confirmed" | "rejected";
  mutationOutcome: "no" | "confirmed" | "dispatched";
  physicalInputCount: 0 | 1 | 2 | 3 | 4;
  failureCode: string | null;
  nativeCauseCode: string | null;
  completedAt: string;
  resultHash: `sha256:${string}`;
  submitRecoveryPayload: Readonly<Record<string, unknown>> | null;
}>;
export type BrowserMutationTerminalFact = Readonly<{
  type: "fact"; commandId: string; receiptBindingHash: `sha256:${string}`;
  terminalReceipt: BrowserMutationTerminalReceipt; receiptHash: `sha256:${string}`;
}>;
export type BrowserMutationDisposeRequest = Readonly<{
  type: "dispose"; commandId: string; receiptBindingHash: `sha256:${string}`;
  rejectedFact: unknown; rejectedFactHash: `sha256:${string}` | null;
}>;
export type BrowserMutationDisposed = Readonly<{
  type: "disposed"; commandId: string; receiptBindingHash: `sha256:${string}`;
  rejectedFactHash: `sha256:${string}` | null;
  reasonCode: "BROWSER_RECONCILIATION_RECEIPT_INVALID" | "BROWSER_COMMAND_RECEIPT_MISSING" | "BROWSER_MUTATION_STATE_CONFLICT";
}>;
export const browserMutationReceiptBindingProjection = (identity: BrowserMutationIdentity): readonly unknown[] => [
  identity.commandId, identity.exactCallIdentityHash, identity.jobId, identity.attemptId,
  identity.resultRevision, identity.leaseVersion, identity.executionFenceHash,
  identity.deliveryPriorityReplayGrantHash, identity.productStepId, identity.callId,
  identity.childCapabilityId, identity.effectScope, identity.actionOrdinal, identity.actionId,
  identity.positivePostconditionHash, identity.negativePostconditionHash,
  identity.requestHash, identity.payloadHash,
];
export const browserMutationTerminalFactBytes = (
  fact: Pick<BrowserMutationTerminalFact, "commandId" | "receiptBindingHash" | "terminalReceipt">,
): string => canonicalizeBrowserAuthorityValue({ commandId: fact.commandId,
  receiptBindingHash: fact.receiptBindingHash, terminalReceipt: fact.terminalReceipt });
export const browserMutationTerminalFactShapeValid = (value: unknown): value is BrowserMutationTerminalFact => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fact = value as Record<string, unknown>;
  const receipt = fact.terminalReceipt as Record<string, unknown> | null;
  return exactKeys(fact, ["type", "commandId", "receiptBindingHash", "terminalReceipt", "receiptHash"])
    && fact.type === "fact" && typeof fact.commandId === "string" && fact.commandId.length > 0
    && [fact.receiptBindingHash, fact.receiptHash].every(hash => typeof hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(hash))
    && !!receipt && typeof receipt === "object" && !Array.isArray(receipt)
    && exactKeys(receipt, ["schemaVersion", "terminal", "mutationOutcome", "physicalInputCount",
      "failureCode", "nativeCauseCode", "completedAt", "resultHash", "submitRecoveryPayload"])
    && receipt.schemaVersion === "grasseye.browser.command-terminal-receipt.v1";
};
export type BrowserObservationBinding = Readonly<{
  exactCallIdentityHash: `sha256:${string}`; targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`; observationRevisionHash: `sha256:${string}`;
}>;
export const browserObservationPacketRevisionBytes = (packet: Readonly<Record<string, unknown>>): string =>
  canonicalizeBrowserAuthorityValue({ targetRefHash: packet.targetRefHash ?? null, documentRefHash: packet.documentRefHash ?? null,
    currentUrl: packet.currentUrl ?? null, observedAt: packet.observedAt ?? null, queries: packet.queries ?? null });
export const bindBrowserObservationPacket = (
  value: unknown, specs: readonly BrowserDomObservationQuery[], hashes: BrowserObservationBinding,
): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const packet = value as Record<string, unknown>;
  if (!browserObservationPacketHeaderValid(packet, hashes)
    || !Array.isArray(packet.queries) || packet.queries.length !== specs.length
    || !packet.queries.every((row, index) => row && typeof row === "object" && !Array.isArray(row)
      && row.queryId === specs[index]?.queryId)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return Object.freeze({ ...packet, exactCallIdentityHash: hashes.exactCallIdentityHash });
};
export const bindBrowserMutationObservation = (
  command: BrowserGovernedCommand, result: unknown, hashes: BrowserObservationBinding,
): unknown => {
  if (command.kind !== "dom-intent" || command.intent.kind !== "click"
    || command.intent.postClickObservation === undefined) return result;
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const record = result as Record<string, unknown>;
  if (record.qualificationRejected === true && record.postconditionObservation === undefined) return result;
  return Object.freeze({ ...record, postconditionObservation: bindBrowserObservationPacket(record.postconditionObservation,
    command.intent.postClickObservation.queries, hashes) });
};
const receiptValid = (
  value: Readonly<Record<string, unknown>>,
  input: Readonly<{ schemaVersion: string; failureCode: string; state: "exact_present" | "mismatch" }>,
  observationHash: `sha256:${string}` | null,
): boolean => {
  const fact = value.knownGptRateLimitPreflightFact;
  return exactKeys(value, ["schemaVersion", "failureCode", "nativeCauseCode", "candidateCount",
    "identityRevalidated", "mutationCount", "physicalInputCount", "postconditionVerified",
    "qualificationRejected", "qualificationStage", "knownGptRateLimitPreflightFact"])
    && value.schemaVersion === input.schemaVersion
    && value.failureCode === input.failureCode
    && value.nativeCauseCode === null
    && value.identityRevalidated === true
    && value.mutationCount === 0
    && value.physicalInputCount === 0
    && value.postconditionVerified === false
    && value.qualificationRejected === true
    && value.qualificationStage === "candidate-set"
    && knownGptRateLimitPreflightFactShapeValid(fact)
    && fact.observationHash === observationHash
    && fact.state === input.state
    && value.candidateCount === fact.dialogEligibleCount;
};

export const knownRateLimitBlockerReceiptValid = (
  value: Readonly<Record<string, unknown>>,
  observationHash: `sha256:${string}` | null,
): boolean => receiptValid(value, {
  schemaVersion: "grasseye.browser.known-gpt-rate-limit-blocker.v2",
  failureCode: "BROWSER_KNOWN_GPT_RATE_LIMIT",
  state: "exact_present",
}, observationHash);

export const unrecognizedGptDialogReceiptValid = (
  value: Readonly<Record<string, unknown>>,
  observationHash: `sha256:${string}` | null,
): boolean => receiptValid(value, {
  schemaVersion: "grasseye.browser.gpt-dialog-unrecognized-rejection.v1",
  failureCode: "BROWSER_GPT_DIALOG_UNRECOGNIZED",
  state: "mismatch",
}, observationHash);

const POSTCONDITION_REJECTION_REASONS = new Set([
  "DISCONNECTED", "NO_LAYOUT_BOX", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN", "OPACITY_HIDDEN",
  "HTML_HIDDEN", "ARIA_HIDDEN", "INERT", "TEXT_MISMATCH",
]);

const expectedMatchCount = (command: BrowserGovernedCommand): number | null => {
  if (command.kind !== "dom-intent") return null;
  if (command.intent.kind === "click") return command.intent.postClickMatch?.expectedMatches ?? null;
  if (command.intent.kind === "doubleClick") return command.intent.postDoubleClickMatch.expectedMatches;
  if (command.intent.kind === "keypress") return command.intent.postKeypressMatch.expectedMatches;
  return null;
};

const postconditionCountsValid = (
  value: Readonly<Record<string, unknown>>,
  expected: number | null,
): boolean => Number.isSafeInteger(value.postconditionRawCount)
  && (value.postconditionRawCount as number) >= 0
  && Number.isSafeInteger(value.postconditionEligibleCount)
  && (value.postconditionEligibleCount as number) >= 0
  && (value.postconditionEligibleCount as number) <= (value.postconditionRawCount as number)
  && Array.isArray(value.postconditionRejections)
  && value.postconditionRejections.length === (value.postconditionRawCount as number)
    - (value.postconditionEligibleCount as number)
  && expected !== null
  && value.postconditionVerified === ((value.postconditionEligibleCount as number) === expected);

const postconditionRejectionValid = (
  candidate: unknown,
  rawCount: number,
  indices: Set<number>,
): boolean => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const item = candidate as Readonly<Record<string, unknown>>;
  const index = item.index;
  if (!exactKeys(item, ["index", "reasons"]) || !Number.isSafeInteger(index)
    || (index as number) < 0 || (index as number) >= rawCount || indices.has(index as number)
    || !Array.isArray(item.reasons) || item.reasons.length < 1
    || new Set(item.reasons).size !== item.reasons.length
    || item.reasons.some((reason) => typeof reason !== "string"
      || !POSTCONDITION_REJECTION_REASONS.has(reason))) return false;
  indices.add(index as number);
  return true;
};

const postconditionFailureCause = (
  value: Readonly<Record<string, unknown>>,
  expected: number,
): string => {
  const firstReason = (value.postconditionRejections as readonly Readonly<Record<string, unknown>>[])[0]
    ?.reasons as readonly string[] | undefined;
  if ((value.postconditionEligibleCount as number) > expected) return "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  if ((value.postconditionRawCount as number) === 0) return "BROWSER_DOM_CANDIDATE_MISSING";
  return firstReason?.[0] ?? "BROWSER_DOM_CANDIDATE_MISSING";
};

export const postconditionEvidenceValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => {
  const expected = expectedMatchCount(command);
  if (!postconditionCountsValid(value, expected)) return false;
  const indices = new Set<number>();
  const rejectionsValid = (value.postconditionRejections as readonly unknown[]).every((candidate) =>
    postconditionRejectionValid(candidate, value.postconditionRawCount as number, indices));
  if (!rejectionsValid || value.postconditionVerified === true) return rejectionsValid;
  return value.nativeCauseCode === postconditionFailureCause(value, expected!);
};


const browserObservationPacketHeaderValid = (packet: Record<string, unknown>, hashes: BrowserObservationBinding): boolean =>
  exactKeys(packet, ["schemaVersion", "targetRefHash", "documentRefHash", "currentUrl", "observationRevisionHash", "observedAt", "queries"])
  && packet.schemaVersion === "grasseye.browser.dom-observation.v2"
  && packet.targetRefHash === hashes.targetRefHash && packet.documentRefHash === hashes.documentRefHash
  && packet.observationRevisionHash === hashes.observationRevisionHash
  && typeof packet.currentUrl === "string" && packet.currentUrl.length > 0
  && typeof packet.observedAt === "string" && Number.isFinite(Date.parse(packet.observedAt))
  && new Date(packet.observedAt).toISOString() === packet.observedAt;
