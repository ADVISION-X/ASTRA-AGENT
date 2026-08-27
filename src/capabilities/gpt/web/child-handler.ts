import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
  GptExecutionContext,
} from "../contract.js";
import { executionFailure } from "../../../lib/typed-failure.js";

export type GptChildObservation = Readonly<{
  value: unknown;
  candidateCount: number | null;
  observedSemantics: readonly string[];
  committedMutation: "no" | "yes";
  postconditionResult: "passed";
}>;

export type GptChildHandler = (
  intent: GptChildCapabilityIntent,
  context: GptExecutionContext,
) => Promise<GptChildObservation>;

export type GptChildHandlerMap = Partial<Record<GptChildCapabilityId, GptChildHandler>>;

export const requireBrowser = (context: GptExecutionContext) => {
  if (!context.browser) throw executionFailure("review_required", "GPT_BROWSER_TARGET_REQUIRED");
  if (context.signal?.aborted) throw executionFailure("recovery_pending", "GPT_EXECUTION_ABORTED");
  return context.browser;
};

export const requireExactInputKeys = (
  intent: GptChildCapabilityIntent,
  required: readonly string[],
  optional: readonly string[] = [],
): void => {
  const keys = Object.keys(intent.input).sort();
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !(key in intent.input));
  const extra = keys.filter((key) => !allowed.has(key));
  if (missing.length || extra.length) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:missing=${missing.join(",")}:extra=${extra.join(",")}`);
  }
};

export const stringInput = (intent: GptChildCapabilityIntent, key: string): string => {
  const value = intent.input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const booleanInput = (intent: GptChildCapabilityIntent, key: string): boolean => {
  const value = intent.input[key];
  if (typeof value !== "boolean") {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const numberInput = (intent: GptChildCapabilityIntent, key: string): number => {
  const value = intent.input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const recordInput = (intent: GptChildCapabilityIntent, key: string): Readonly<Record<string, unknown>> => {
  const value = intent.input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as Readonly<Record<string, unknown>>;
};

export const arrayInput = (intent: GptChildCapabilityIntent, key: string): readonly unknown[] => {
  const value = intent.input[key];
  if (!Array.isArray(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const success = (input: Omit<GptChildObservation, "postconditionResult">): GptChildObservation =>
  Object.freeze({ ...input, postconditionResult: "passed" });
