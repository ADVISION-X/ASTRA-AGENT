import { BROWSER_PROTOCOL_REVISION } from "../protocol/generated/browser-protocol.generated.js";

export const BROWSER_AUTHORITY_PROTOCOL_VERSION = BROWSER_PROTOCOL_REVISION;

export type BrowserAuthorityFrame = Readonly<{
  protocolVersion: typeof BROWSER_AUTHORITY_PROTOCOL_VERSION;
  kind: "PAIR_HELLO" | "PAIR_CHALLENGE" | "PAIR_PROOF" | "AUTHENTICATED" | "READY" | "HEARTBEAT" | "COMMAND" | "MUTATION_PROGRESS" | "REPLY" | "TARGET_ACQUIRE" | "TARGET_CLAIM" | "TARGET_REVOKE" | "DIAGNOSTIC" | "REVOKE" | "ARTIFACT_CHUNK";
  epoch: number;
  sequence: number;
  deadline: string;
  body: Readonly<Record<string, unknown>>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isPlainValue = (value: unknown): boolean => value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  || (Array.isArray(value) && value.every(isPlainValue))
  || (isRecord(value) && Object.values(value).every(isPlainValue));

/** Deterministic JSON object ordering for every encrypted transcript payload. */
export const canonicalizeBrowserAuthorityValue = (value: unknown): string => {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("BROWSER_AUTH_FRAME_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeBrowserAuthorityValue).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeBrowserAuthorityValue(value[key])}`).join(",")}}`;
  throw new Error("BROWSER_AUTH_FRAME_INVALID");
};

export const encodeBrowserAuthorityFrame = (frame: BrowserAuthorityFrame): string => {
  assertBrowserAuthorityFrame(frame);
  return canonicalizeBrowserAuthorityValue(frame);
};

export const decodeBrowserAuthorityFrame = (encoded: string): BrowserAuthorityFrame => {
  let value: unknown;
  try { value = JSON.parse(encoded); } catch { throw new Error("BROWSER_AUTH_FRAME_INVALID"); }
  assertBrowserAuthorityFrame(value);
  if (canonicalizeBrowserAuthorityValue(value) !== encoded) throw new Error("BROWSER_AUTH_FRAME_INVALID");
  return value;
};

export function assertBrowserAuthorityFrame(value: unknown): asserts value is BrowserAuthorityFrame {
  if (!isRecord(value)) throw new Error("BROWSER_AUTH_FRAME_INVALID");
  const { protocolVersion, kind, epoch, sequence, deadline, body } = value;
  if (protocolVersion !== BROWSER_AUTHORITY_PROTOCOL_VERSION
    || typeof kind !== "string" || !["PAIR_HELLO", "PAIR_CHALLENGE", "PAIR_PROOF", "AUTHENTICATED", "READY", "HEARTBEAT", "COMMAND", "MUTATION_PROGRESS", "REPLY", "TARGET_ACQUIRE", "TARGET_CLAIM", "TARGET_REVOKE", "DIAGNOSTIC", "REVOKE", "ARTIFACT_CHUNK"].includes(kind)
    || typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch < 0
    || typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 0
    || typeof deadline !== "string" || Number.isNaN(Date.parse(deadline))
    || !isRecord(body) || !isPlainValue(body)) throw new Error("BROWSER_AUTH_FRAME_INVALID");
}
