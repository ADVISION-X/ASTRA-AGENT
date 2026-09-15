import { asRecord } from "./websocket-actor-crypto.js";

export type TargetOperation = Readonly<{
  action: "release";
  jobRefHash: `sha256:${string}`;
}> | Readonly<{
  action: "acquire";
  jobRefHash: `sha256:${string}`;
  targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation";
  parentConversationUrl?: string;
}>;

const hasExactKeys = (value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));

export const targetOperationFrom = (value: unknown): TargetOperation => {
  const request = asRecord(value);
  if (!request) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const jobRefHash = typeof request.jobRefHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(request.jobRefHash)
    ? request.jobRefHash as `sha256:${string}`
    : (() => { throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID"); })();
  if (request.action === "release") {
    if (!hasExactKeys(request, ["action", "jobRefHash"])) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    return { action: "release", jobRefHash };
  }
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
