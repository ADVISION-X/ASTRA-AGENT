import type { BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";
import { asRecord } from "./websocket-actor-crypto.js";

export type TargetOperation = Readonly<{
  action: "cancel-acquisition";
  jobRefHash: `sha256:${string}`;
  requestSequence: number;
}> | Readonly<{
  action: "release";
  releaseAuthority: BrowserTargetReleaseAuthority;
  jobRefHash: `sha256:${string}`;
}> | Readonly<{
  action: "acquire";
  jobRefHash: `sha256:${string}`;
  targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation";
  parentConversationUrl?: string;
}>;

export type PendingTargetHandler = {
  readonly promise: Promise<void>;
  readonly action: "acquire" | "release";
  readonly jobRefHash: `sha256:${string}`;
  readonly serverToClientKey: CryptoKey;
  readonly clientToServerKey: CryptoKey;
  cancelled: boolean;
};

const hasExactKeys = (value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));

const parseJobRefHash = (request: Readonly<Record<string, unknown>>): `sha256:${string}` => {
  const value = request.jobRefHash;
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return value as `sha256:${string}`;
};

const parseRelease = (
  request: Readonly<Record<string, unknown>>, jobRefHash: `sha256:${string}`,
): Extract<TargetOperation, { action: "release" }> => {
  if (!hasExactKeys(request, ["action", "jobRefHash", "releaseAuthority"])
    || (request.releaseAuthority !== "business-admitted" && request.releaseAuthority !== "wait-new-attempt"
      && request.releaseAuthority !== "website-admin-deletion")) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { action: "release", jobRefHash, releaseAuthority: request.releaseAuthority };
};

const parseAcquire = (
  request: Readonly<Record<string, unknown>>, jobRefHash: `sha256:${string}`,
): Extract<TargetOperation, { action: "acquire" }> => {
  const targetMode = request.targetMode;
  const validMode = targetMode === "fresh" || targetMode === "bound-observation"
    || targetMode === "confirmed-readback" || targetMode === "authorized-continuation";
  const continuation = targetMode === "authorized-continuation";
  if (request.action !== "acquire" || !validMode
    || typeof request.parentConversationUrl !== (continuation ? "string" : "undefined")
    || !hasExactKeys(request, ["action", "targetMode", "jobRefHash",
      ...(continuation ? ["parentConversationUrl"] : [])])) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { action: "acquire", jobRefHash, targetMode,
    ...(continuation ? { parentConversationUrl: request.parentConversationUrl as string } : {}) };
};

const parseCancellation = (request: Readonly<Record<string, unknown>>,
  jobRefHash: `sha256:${string}`): Extract<TargetOperation, { action: "cancel-acquisition" }> => {
  if (!hasExactKeys(request, ["action", "jobRefHash", "requestSequence"])
    || !Number.isSafeInteger(request.requestSequence) || (request.requestSequence as number) < 1) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { action: "cancel-acquisition", jobRefHash, requestSequence: request.requestSequence as number };
};

export const targetOperationFrom = (value: unknown): TargetOperation => {
  const request = asRecord(value);
  if (!request) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const job = parseJobRefHash(request);
  if (request.action === "cancel-acquisition") return parseCancellation(request, job);
  return request.action === "release" ? parseRelease(request, job) : parseAcquire(request, job);
};

export const cancelPendingTargetAcquisition = (handlers: ReadonlyMap<number, PendingTargetHandler>,
  request: Extract<TargetOperation, { action: "cancel-acquisition" }>,
  session: Readonly<{ serverToClientKey: CryptoKey; clientToServerKey: CryptoKey }>): void => {
  const handler = handlers.get(request.requestSequence);
  if (handler?.action !== "acquire" || handler.jobRefHash !== request.jobRefHash
    || handler.serverToClientKey !== session.serverToClientKey
    || handler.clientToServerKey !== session.clientToServerKey) return;
  handler.cancelled = true;
};
