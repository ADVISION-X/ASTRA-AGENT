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
  queryIndex: number | undefined,
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
    cause: queryIndex === undefined ? baseCause : browserPostconditionNativeCause(queryIndex, baseCause) };
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
  command: BrowserGovernedCommand,
  packet: Readonly<Record<string, unknown>>,
): boolean => {
  if (command.kind !== "dom-intent" || command.intent.kind !== "click") return false;
  const exactOutgoing = command.intent.preClickExactOutgoingTurn;
  if (exactOutgoing === undefined) return true;
  const firstQuery = (packet.queries as readonly Readonly<Record<string, unknown>>[])[0];
  const firstMatch = Array.isArray(firstQuery?.matches) ? firstQuery.matches[0] : undefined;
  const match = firstMatch && typeof firstMatch === "object" && !Array.isArray(firstMatch)
    ? firstMatch as Readonly<Record<string, unknown>> : null;
  return match?.exactGptUserPromptHash === exactOutgoing.expectedPromptHash;
};

export const observationPostconditionEvidenceValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => {
  const observed = postconditionPacket(command, value);
  if (!observed) return false;
  const { postcondition, packet } = observed;
  if (!coherentPacketHeaderValid(packet, postcondition.queries.length)) return false;
  const exactOutgoing = command.kind === "dom-intent" && command.intent.kind === "click"
    ? command.intent.preClickExactOutgoingTurn : undefined;
  const rows = (packet.queries as readonly unknown[]).map((candidate, index) =>
    coherentRowResult(candidate, postcondition.queries[index]!, exactOutgoing === undefined ? index : undefined));
  const rowsValid = rows.every((row) => row.valid);
  const ordinaryCause = rows.find((row) => row.cause !== null)?.cause ?? null;
  const exactVerified = exactOutgoingPostconditionVerified(command, packet);
  const verified = ordinaryCause === null && exactVerified;
  const expectedCause = exactOutgoing !== undefined && !exactVerified
    ? "BROWSER_DOM_CANDIDATE_MISSING" : ordinaryCause;
  return rowsValid && value.postconditionVerified === verified
    && (verified ? value.nativeCauseCode === undefined : value.nativeCauseCode === expectedCause);
};
