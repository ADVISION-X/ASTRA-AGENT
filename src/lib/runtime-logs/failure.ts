import { RuntimeFailureImpact, RuntimeFailureKind, type RuntimeFailure,
  type RuntimeFailureKind as RuntimeFailureKindValue, type RuntimeLogOwner } from "./runtime-failure-contract.js";

const cleanExplicitCode = (value: string): string => {
  const code = value.trim().split(/[\s:]/u)[0] ?? "";
  return /^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/u.test(code) ? code : "INTERNAL_FAILURE";
};
const knownNativeCause = (value: unknown): string | undefined => typeof value === "string"
  ? ["NO_LAYOUT_BOX", "SUBMIT_BUTTON_DISABLED", "COMPOSER_DOM_DISABLED"].includes(value) ? value
    : /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_[A-Z_]+|CHROME_DEBUGGER_TARGET_CLOSED|CHROME_DEBUGGER_CANCELED_BY_USER)\b/u.exec(value)?.[1]
  : undefined;

const failureDetails = (error: unknown): Readonly<{ nativeCause?: string; httpStatus?: number }> => {
  const seen = new Set<object>();
  let current = error, nativeCause: string | undefined, httpStatus: number | undefined;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as Readonly<Record<string, unknown>>;
    const code = knownNativeCause(record.code) ?? (current instanceof Error ? knownNativeCause(current.message) : undefined);
    if (code) nativeCause = code;
    if (Number.isInteger(record.httpStatus) && Number(record.httpStatus) >= 100 && Number(record.httpStatus) <= 599) {
      httpStatus = Number(record.httpStatus);
    }
    current = record.cause;
  }
  nativeCause = knownNativeCause(current) ?? nativeCause;
  return { ...(nativeCause ? { nativeCause } : {}), ...(httpStatus === undefined ? {} : { httpStatus }) };
};

const classifyKind = (code: string): RuntimeFailureKindValue => {
  const rules: readonly (readonly [RegExp, RuntimeFailureKindValue])[] = [
    [/ECONN|ETIMEDOUT|UND_ERR|FETCH|NETWORK|SOCKET|TRANSPORT/iu, RuntimeFailureKind.TRANSPORT],
    [/DATABASE|STORAGE|CHECKPOINT|UPLOAD|OUTBOX|DISK/iu, RuntimeFailureKind.STORAGE],
    [/BROWSER|TARGET|DOCUMENT|MUTATION|UNKNOWN/iu, RuntimeFailureKind.BROWSER],
    [/CONTRACT|SCHEMA|MANIFEST|BINDING|HASH_MISMATCH|DRIFT/iu, RuntimeFailureKind.CONTRACT],
    [/AUTH|CREDENTIAL|FORBIDDEN|UNAUTHORIZED|TOKEN|SESSION/iu, RuntimeFailureKind.AUTHENTICATION],
    [/ADMISSION|CLAIM|LEASE|FENCE|CAPACITY|STALE/iu, RuntimeFailureKind.ADMISSION],
    [/PROVIDER|MODEL|HTTP|REMOTE|REJECT/iu, RuntimeFailureKind.PROVIDER],
    [/DEPENDENCY|CHANNEL_UNAVAILABLE/iu, RuntimeFailureKind.DEPENDENCY],
  ];
  return rules.find(([pattern]) => pattern.test(code))?.[1] ?? RuntimeFailureKind.INTERNAL;
};

export const runtimeFailureFromError = (input: Readonly<{
  error: unknown; responsibleOwner: RuntimeLogOwner; kind?: RuntimeFailureKindValue;
  code?: string; impact?: RuntimeFailure["impact"]; causedByEventId?: string; httpStatus?: number;
}>): RuntimeFailure => {
  const code = input.code === undefined ? "INTERNAL_FAILURE" : cleanExplicitCode(input.code);
  const details = failureDetails(input.error), status = input.httpStatus ?? details.httpStatus;
  return { kind: input.kind ?? classifyKind(details.nativeCause ?? code), code,
    responsibleOwner: input.responsibleOwner, impact: input.impact ?? RuntimeFailureImpact.BLOCKING,
    ...(details.nativeCause ? { nativeCause: details.nativeCause } : {}),
    ...(status === undefined ? {} : { httpStatus: status }),
    ...(input.causedByEventId ? { causedByEventId: input.causedByEventId } : {}) };
};

const RUNTIME_CAUSE_EVENT = Symbol.for("grasseye.runtime-log.cause-event");
export const withRuntimeLogCauseFact = <T extends object>(target: T, eventId: string): T => {
  Object.defineProperty(target, RUNTIME_CAUSE_EVENT, { configurable: true, enumerable: false, value: eventId, writable: true });
  return target;
};
export const withRuntimeLogCause = (error: unknown, eventId: string): Error =>
  withRuntimeLogCauseFact(error instanceof Error ? error : new Error(String(error)), eventId);
export const runtimeLogCauseEventId = (error: unknown): string | null => {
  const seen = new Set<object>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = Reflect.get(current, RUNTIME_CAUSE_EVENT) as unknown;
    if (typeof value === "string" && value.length > 0) return value;
    current = Reflect.get(current, "cause") as unknown;
  }
  return null;
};
