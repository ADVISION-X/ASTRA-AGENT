import { asRecord } from "./websocket-actor-crypto.js";

export type TargetOperation = Readonly<{
  action: "release";
  jobRefHash: `sha256:${string}`;
  targetRefs: readonly string[];
}> | Readonly<{
  action: "acquire";
  jobRefHash: `sha256:${string}`;
  targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation";
  parentConversationUrl?: string;
  expectedTargetRef?: string;
}>;

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
  const targetRefs = request.targetRefs;
  if (!hasExactKeys(request, ["action", "jobRefHash", "targetRefs"])
    || !Array.isArray(targetRefs)
    || targetRefs.some((ref) => typeof ref !== "string" || !/^target-tab-\d+$/u.test(ref))
    || new Set(targetRefs).size !== targetRefs.length) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { action: "release", jobRefHash, targetRefs: targetRefs as string[] };
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
    || (request.expectedTargetRef !== undefined
      && (typeof request.expectedTargetRef !== "string"
        || !/^target-tab-\d+$/u.test(request.expectedTargetRef)))
    || !hasExactKeys(request, ["action", "targetMode", "jobRefHash",
      ...(continuation ? ["parentConversationUrl"] : []),
      ...(request.expectedTargetRef ? ["expectedTargetRef"] : [])])) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { action: "acquire", jobRefHash, targetMode,
    ...(continuation ? { parentConversationUrl: request.parentConversationUrl as string } : {}),
    ...(request.expectedTargetRef
      ? { expectedTargetRef: request.expectedTargetRef as string } : {}) };
};

export const targetOperationFrom = (value: unknown): TargetOperation => {
  const request = asRecord(value);
  if (!request) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const jobRefHash = parseJobRefHash(request);
  return request.action === "release"
    ? parseRelease(request, jobRefHash)
    : parseAcquire(request, jobRefHash);
};
