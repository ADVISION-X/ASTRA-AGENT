import {
  RuntimeFailureImpact,
  RuntimeFailureKind,
  RuntimeRecovery,
  type RuntimeFailure,
  type RuntimeFailureKind as RuntimeFailureKindValue,
  type RuntimeLogOwner,
} from "./schema.js";

const cleanExplicitCode = (value: string): string => {
  const code = value.trim().split(/[\s:]/u)[0] ?? "";
  return /^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/u.test(code) ? code : "INTERNAL_FAILURE";
};

const nativeCause = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) return undefined;
  const cause = error.cause;
  const known = (value: string): string | undefined =>
    /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_[A-Z_]+)\b/u.exec(value)?.[1];
  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string") return known(cause.code);
  if (cause instanceof Error) return known(cause.message);
  return /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_[A-Z_]+)\b/u.exec(error.message)?.[1];
};

const classifyKind = (code: string): RuntimeFailureKindValue => {
  if (/ECONN|ETIMEDOUT|UND_ERR|FETCH|NETWORK|SOCKET/iu.test(code)) return RuntimeFailureKind.TRANSPORT;
  if (/DATABASE|STORAGE|CHECKPOINT|UPLOAD|OUTBOX|DISK/iu.test(code)) return RuntimeFailureKind.STORAGE;
  if (/BROWSER|TARGET|DOCUMENT|MUTATION|UNKNOWN/iu.test(code)) return RuntimeFailureKind.BROWSER;
  if (/CONTRACT|SCHEMA|MANIFEST|BINDING|HASH_MISMATCH|DRIFT/iu.test(code)) return RuntimeFailureKind.CONTRACT;
  if (/AUTH|CREDENTIAL|FORBIDDEN|UNAUTHORIZED|TOKEN|SESSION/iu.test(code)) return RuntimeFailureKind.AUTHENTICATION;
  if (/ADMISSION|CLAIM|LEASE|FENCE|CAPACITY|STALE/iu.test(code)) return RuntimeFailureKind.ADMISSION;
  if (/PROVIDER|MODEL|HTTP|REMOTE|REJECT/iu.test(code)) return RuntimeFailureKind.PROVIDER;
  if (/DEPENDENCY|CHANNEL_UNAVAILABLE/iu.test(code)) return RuntimeFailureKind.DEPENDENCY;
  return RuntimeFailureKind.INTERNAL;
};

export const runtimeFailureFromError = (input: Readonly<{
  error: unknown;
  responsibleOwner: RuntimeLogOwner;
  kind?: RuntimeFailureKindValue;
  code?: string;
  recovery?: RuntimeFailure["recovery"];
  impact?: RuntimeFailure["impact"];
  causedByEventId?: string;
  httpStatus?: number;
}>): RuntimeFailure => {
  const code = input.code === undefined ? "INTERNAL_FAILURE" : cleanExplicitCode(input.code);
  const cause = nativeCause(input.error);
  return {
    kind: input.kind ?? classifyKind(cause ?? code),
    code,
    responsibleOwner: input.responsibleOwner,
    impact: input.impact ?? RuntimeFailureImpact.BLOCKING,
    recovery: input.recovery ?? RuntimeRecovery.STOP,
    ...(cause ? { nativeCause: cause } : {}),
    ...(input.causedByEventId ? { causedByEventId: input.causedByEventId } : {}),
    ...(input.httpStatus === undefined ? {} : { httpStatus: input.httpStatus }),
  };
};

const RUNTIME_CAUSE_EVENT = Symbol.for("grasseye.runtime-log.cause-event");

export const withRuntimeLogCause = (error: unknown, eventId: string): Error => {
  const target = error instanceof Error ? error : new Error(String(error));
  Object.defineProperty(target, RUNTIME_CAUSE_EVENT, {
    configurable: true,
    enumerable: false,
    value: eventId,
    writable: true,
  });
  return target;
};

export const runtimeLogCauseEventId = (error: unknown): string | null => {
  if (!(error instanceof Error)) return null;
  const value = (error as unknown as Record<symbol, unknown>)[RUNTIME_CAUSE_EVENT];
  return typeof value === "string" && value.length > 0 ? value : null;
};
