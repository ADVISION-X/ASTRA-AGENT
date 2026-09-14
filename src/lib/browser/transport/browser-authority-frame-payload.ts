import { timingSafeEqual } from "node:crypto";

import {
  canonicalizeBrowserAuthorityValue,
  type BrowserAuthorityFrame,
} from "./browser-authority-frame-codec.js";
import { requireGptWebClaimOrigin } from "../exact-target/browser-site-policy-registry.js";

export type BrowserAuthorityTargetClaim = Readonly<{
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  claimOrigin: "https://chatgpt.com";
  jobRefHash: `sha256:${string}`;
}>;
export type BrowserAuthorityTargetRevoke = Readonly<{
  targetRef: string;
  jobRefHash?: never;
  releaseOutcome?: never;
}> | Readonly<{
  targetRef: string | null;
  jobRefHash: `sha256:${string}`;
  releaseOutcome: "released" | "absent";
}>;

export const authorityRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const encryptedFrameBody = (
  frame: BrowserAuthorityFrame,
): Readonly<{ nonce: string; ciphertext: string; tag: string }> => {
  const body = authorityRecord(frame.body);
  const encrypted = body ? authorityRecord(body.encrypted) : null;
  if (!encrypted || typeof encrypted.nonce !== "string"
    || typeof encrypted.ciphertext !== "string" || typeof encrypted.tag !== "string") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { nonce: encrypted.nonce, ciphertext: encrypted.ciphertext, tag: encrypted.tag };
};

export const canonicalBrowserAuthorityPlaintext = (value: unknown): string =>
  canonicalizeBrowserAuthorityValue(value);

export const parseCanonicalPlaintext = (value: string): Record<string, unknown> => {
  try {
    const body = authorityRecord(JSON.parse(value) as unknown);
    if (!body || canonicalBrowserAuthorityPlaintext(body) !== value) throw new Error("invalid canonical plaintext");
    return body;
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

export const compareReplyToken = (actual: string, expected: string): boolean => {
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
};

export const stringField = (body: Readonly<Record<string, unknown>>, name: string): string => {
  const value = body[name];
  if (typeof value !== "string" || value.length === 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};

const nonNegativeIntegerField = (body: Readonly<Record<string, unknown>>, name: string): number => {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};

export const parseBrowserAuthorityTargetClaim = (
  body: Readonly<Record<string, unknown>>,
): BrowserAuthorityTargetClaim => {
  const targetRef = stringField(body, "targetRef");
  const documentRef = stringField(body, "documentRef");
  const navigationEpoch = nonNegativeIntegerField(body, "navigationEpoch");
  const claimOrigin = stringField(body, "claimOrigin");
  const jobRefHash = stringField(body, "jobRefHash");
  if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash) || Object.keys(body).length !== 5
    || Object.keys(body).some((key) => !["targetRef", "documentRef", "navigationEpoch", "claimOrigin", "jobRefHash"].includes(key))) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { targetRef, documentRef, navigationEpoch, claimOrigin: requireGptWebClaimOrigin(claimOrigin),
    jobRefHash: jobRefHash as `sha256:${string}` };
};

export const parseBrowserAuthorityTargetRevoke = (
  body: Readonly<Record<string, unknown>>,
): BrowserAuthorityTargetRevoke => {
  if (Object.keys(body).length === 1) return { targetRef: stringField(body, "targetRef") };
  const targetRef = body.targetRef;
  const jobRefHash = body.jobRefHash;
  const releaseOutcome = body.releaseOutcome;
  if (Object.keys(body).length !== 3
    || (targetRef !== null && (typeof targetRef !== "string" || targetRef.length === 0))
    || typeof jobRefHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)
    || (releaseOutcome !== "released" && releaseOutcome !== "absent")
    || (releaseOutcome === "released") !== (typeof targetRef === "string")) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { targetRef: targetRef as string | null, jobRefHash: jobRefHash as `sha256:${string}`,
    releaseOutcome };
};
