import { createHash, timingSafeEqual } from "node:crypto";
import type { BrowserCommandPermit } from "./command-permit.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { verifyNormalBrowserMutationReply } from "../exact-target/browser-command-postcondition.js";
import { browserMutationTerminalFactShapeValid, type BrowserMutationTerminalFact, type BrowserMutationDisposeRequest } from "../exact-target/browser-observation-receipt.js";
import { BROWSER_ERROR_CODES } from "../protocol/generated/browser-protocol.generated.js";
import { canonicalizeBrowserAuthorityValue, type BrowserAuthorityFrame } from "./browser-authority-frame-codec.js";
import { requireGptWebClaimOrigin } from "../exact-target/browser-site-policy-registry.js";

export type BrowserAuthorityTargetClaim = Readonly<{ targetRef: string; documentRef: string; navigationEpoch: number;
  claimOrigin: "https://chatgpt.com"; jobRefHash: `sha256:${string}` }>;
export type BrowserAuthorityTargetRevoke = Readonly<{ targetRef: string; documentRef: string;
  jobRefHash: `sha256:${string}`; releaseOutcome?: never }>
  | Readonly<{ targetRef: string | null; jobRefHash: `sha256:${string}`; releaseOutcome: "released" | "absent" }>;
export const authorityRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const canonicalBrowserAuthorityPlaintext = (value: unknown): string => canonicalizeBrowserAuthorityValue(value);
export const encryptedFrameBody = (frame: BrowserAuthorityFrame): Readonly<{ nonce: string; ciphertext: string; tag: string }> => {
  const encrypted = authorityRecord(authorityRecord(frame.body)?.encrypted);
  if (!encrypted || ![encrypted.nonce, encrypted.ciphertext, encrypted.tag].every(field => typeof field === "string")) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return encrypted as { nonce: string; ciphertext: string; tag: string };
};
export const parseCanonicalPlaintext = (value: string): Record<string, unknown> => {
  try {
    const body = authorityRecord(JSON.parse(value) as unknown);
    if (!body || canonicalBrowserAuthorityPlaintext(body) !== value) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    return body;
  } catch { throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID"); }
};
export const compareReplyToken = (actual: string, expected: string): boolean => {
  const left = Buffer.from(actual, "utf8"), right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
};
export const stringField = (body: Readonly<Record<string, unknown>>, name: string): string => {
  const value = body[name];
  if (typeof value !== "string" || value.length === 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};
export const integerField = (body: Readonly<Record<string, unknown>>, name: string, minimum = 0): number => {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};
export const parseBrowserAuthorityTargetClaim = (body: Readonly<Record<string, unknown>>): BrowserAuthorityTargetClaim => {
  if (Object.keys(body).sort().join("|") !== "claimOrigin|documentRef|jobRefHash|navigationEpoch|targetRef") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const jobRefHash = stringField(body, "jobRefHash");
  if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { targetRef: stringField(body, "targetRef"), documentRef: stringField(body, "documentRef"),
    navigationEpoch: integerField(body, "navigationEpoch"), claimOrigin: requireGptWebClaimOrigin(stringField(body, "claimOrigin")),
    jobRefHash: jobRefHash as `sha256:${string}` };
};
export const parseBrowserAuthorityTargetRevoke = (body: Readonly<Record<string, unknown>>): BrowserAuthorityTargetRevoke => {
  const jobRefHash = stringField(body, "jobRefHash");
  if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  if (!Object.hasOwn(body, "releaseOutcome")) {
    if (Object.keys(body).sort().join("|") !== "documentRef|jobRefHash|targetRef") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    return { jobRefHash: jobRefHash as `sha256:${string}`, targetRef: stringField(body, "targetRef"), documentRef: stringField(body, "documentRef") };
  }
  const targetRef = body.targetRef, releaseOutcome = body.releaseOutcome;
  if (Object.keys(body).sort().join("|") !== "jobRefHash|releaseOutcome|targetRef"
    || (targetRef !== null && (typeof targetRef !== "string" || targetRef.length === 0))
    || !["released", "absent"].includes(String(releaseOutcome))
    || (releaseOutcome === "absent") !== (targetRef === null)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { targetRef: targetRef as string | null, jobRefHash: jobRefHash as `sha256:${string}`, releaseOutcome: releaseOutcome as "released" | "absent" };
};
export const parseBrowserMutationReceiptMessage = (body: unknown): BrowserMutationTerminalFact | BrowserMutationDisposeRequest => {
  if (browserMutationTerminalFactShapeValid(body)) return body;
  const request = authorityRecord(body);
  if (!request || Object.keys(request).sort().join("|") !== "commandId|receiptBindingHash|rejectedFact|rejectedFactHash|type"
    || request.type !== "dispose" || typeof request.commandId !== "string" || !request.commandId
    || typeof request.receiptBindingHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(request.receiptBindingHash)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const hash = request.rejectedFact === null ? null
    : `sha256:${createHash("sha256").update(canonicalBrowserAuthorityPlaintext(request.rejectedFact)).digest("hex")}`;
  if (hash !== request.rejectedFactHash) throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
  return request as BrowserMutationDisposeRequest;
};
/** Authenticate the existing five-key reply; the original Store remains the sole terminal CAS owner. */
export const parseBrowserCommandReply = (body: Record<string, unknown>, permit: BrowserCommandPermit,
  command: BrowserGovernedCommand, receiptBindingHash: `sha256:${string}` | null,
): Readonly<{ fact: BrowserMutationTerminalFact | null; errorCode: string | null }> => {
  const failure = Object.hasOwn(body, "errorCode");
  const keys = ["requestSequence", "permitSequence", "replyChannelToken", "mutationReceipt", failure ? "errorCode" : "result"];
  if (Object.keys(body).length !== 5 || Object.keys(body).some(key => !keys.includes(key))
    || integerField(body, "requestSequence", 1) < 1 || integerField(body, "permitSequence", 1) !== permit.sequence
    || typeof body.replyChannelToken !== "string" || !compareReplyToken(body.replyChannelToken, permit.replyChannelToken)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  if (failure && (typeof body.errorCode !== "string" || !(BROWSER_ERROR_CODES as readonly string[]).includes(body.errorCode))) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const fact = receiptBindingHash === null ? null : verifyNormalBrowserMutationReply(permit, command, body);
  if (fact ? fact.receiptBindingHash !== receiptBindingHash : body.mutationReceipt !== null) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { fact, errorCode: failure ? body.errorCode as string : null };
};
