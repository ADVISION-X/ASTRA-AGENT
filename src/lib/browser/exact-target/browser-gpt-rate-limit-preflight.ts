export const KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR = "[role='dialog']";
export const KNOWN_GPT_RATE_LIMIT_ACK_SELECTOR = "[role='dialog'] button";
export const KNOWN_GPT_RATE_LIMIT_TITLE = "请求过于频繁";
export const KNOWN_GPT_RATE_LIMIT_BODY = Object.freeze([
  "你的请求过于频繁。为保障数据安全，我们已暂时限制你访问对话记录。",
  "请稍等几分钟后再重试。",
]);
export const KNOWN_GPT_RATE_LIMIT_ACK = "明白了";

export const KNOWN_GPT_RATE_LIMIT_DIALOG_HASH =
  "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15" as const;
export const KNOWN_GPT_RATE_LIMIT_TITLE_HASH =
  "sha256:9be2505cb51c4865a12e929317def59d6aa5c5f7f0b16d4a5c43e24a132b06a0" as const;
export const KNOWN_GPT_RATE_LIMIT_BODY_HASH =
  "sha256:b780eb18a127349954421f7765b4fc0eabfcacdd7116b4a6d793b0bfabed7f65" as const;
export const KNOWN_GPT_RATE_LIMIT_ACK_HASH =
  "sha256:e2508646d82fb32324f673fda44801f1f2f2d9e75089a884a9d9345d23c15b69" as const;

export type KnownGptRateLimitPreflightState = "absent" | "exact_present" | "mismatch";

export type KnownGptRateLimitPreflightFact = Readonly<{
  schemaVersion: "grasseye.browser.known-gpt-rate-limit-preflight.v2";
  state: KnownGptRateLimitPreflightState;
  dialogHash: `sha256:${string}`;
  titleHash: `sha256:${string}`;
  bodyHash: `sha256:${string}`;
  acknowledgementHash: `sha256:${string}`;
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observedAt: string;
  dialogRawCount: number;
  dialogEligibleCount: number;
  dialogActionableCount: number;
  acknowledgementButtonRawCount: number;
  acknowledgementButtonEligibleCount: number;
  acknowledgementButtonActionableCount: number;
  observationHash: `sha256:${string}`;
}>;

export const KNOWN_GPT_RATE_LIMIT_PREFLIGHT_FACT_KEYS = Object.freeze([
  "schemaVersion", "state", "dialogHash", "titleHash", "bodyHash", "acknowledgementHash",
  "exactCallIdentityHash", "targetRefHash", "documentRefHash", "observedAt",
  "dialogRawCount", "dialogEligibleCount", "dialogActionableCount",
  "acknowledgementButtonRawCount", "acknowledgementButtonEligibleCount",
  "acknowledgementButtonActionableCount", "observationHash",
] as const);

export const knownGptRateLimitPreflightObservationInput = (
  fact: Omit<KnownGptRateLimitPreflightFact, "observationHash">,
): readonly unknown[] => Object.freeze([
  fact.schemaVersion, fact.state, fact.dialogHash, fact.titleHash, fact.bodyHash,
  fact.acknowledgementHash, fact.exactCallIdentityHash, fact.targetRefHash,
  fact.documentRefHash, fact.observedAt, fact.dialogRawCount, fact.dialogEligibleCount,
  fact.dialogActionableCount, fact.acknowledgementButtonRawCount,
  fact.acknowledgementButtonEligibleCount, fact.acknowledgementButtonActionableCount,
]);

const exactKeys = (value: Readonly<Record<string, unknown>>): boolean => {
  const keys = Object.keys(value);
  return keys.length === KNOWN_GPT_RATE_LIMIT_PREFLIGHT_FACT_KEYS.length
    && keys.every((key) => (KNOWN_GPT_RATE_LIMIT_PREFLIGHT_FACT_KEYS as readonly string[]).includes(key));
};

const count = (value: unknown): value is number => Number.isSafeInteger(value)
  && (value as number) >= 0;
const hash = (value: unknown): value is `sha256:${string}` => typeof value === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value);

export const knownGptRateLimitPreflightFactShapeValid = (
  value: unknown,
): value is KnownGptRateLimitPreflightFact => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fact = value as Readonly<Record<string, unknown>>;
  if (!exactKeys(fact)
    || fact.schemaVersion !== "grasseye.browser.known-gpt-rate-limit-preflight.v2"
    || !["absent", "exact_present", "mismatch"].includes(String(fact.state))
    || fact.dialogHash !== KNOWN_GPT_RATE_LIMIT_DIALOG_HASH
    || fact.titleHash !== KNOWN_GPT_RATE_LIMIT_TITLE_HASH
    || fact.bodyHash !== KNOWN_GPT_RATE_LIMIT_BODY_HASH
    || fact.acknowledgementHash !== KNOWN_GPT_RATE_LIMIT_ACK_HASH
    || ![fact.exactCallIdentityHash, fact.targetRefHash, fact.documentRefHash,
      fact.observationHash].every(hash)
    || typeof fact.observedAt !== "string"
    || !Number.isFinite(Date.parse(fact.observedAt))
    || new Date(fact.observedAt).toISOString() !== fact.observedAt) return false;
  const counts = [fact.dialogRawCount, fact.dialogEligibleCount, fact.dialogActionableCount,
    fact.acknowledgementButtonRawCount, fact.acknowledgementButtonEligibleCount,
    fact.acknowledgementButtonActionableCount];
  if (!counts.every(count)
    || (fact.dialogEligibleCount as number) > (fact.dialogRawCount as number)
    || (fact.dialogActionableCount as number) > (fact.dialogEligibleCount as number)
    || (fact.acknowledgementButtonEligibleCount as number)
      > (fact.acknowledgementButtonRawCount as number)
    || (fact.acknowledgementButtonActionableCount as number)
      > (fact.acknowledgementButtonEligibleCount as number)) return false;
  const exact = fact.dialogRawCount === 1 && fact.dialogEligibleCount === 1
    && fact.dialogActionableCount === 1 && fact.acknowledgementButtonRawCount === 1
    && fact.acknowledgementButtonEligibleCount === 1
    && fact.acknowledgementButtonActionableCount === 1;
  if (fact.state === "absent") return (fact.dialogEligibleCount as number) === 0;
  if (fact.state === "exact_present") return exact;
  return (fact.dialogEligibleCount as number) > 0 && !exact;
};
