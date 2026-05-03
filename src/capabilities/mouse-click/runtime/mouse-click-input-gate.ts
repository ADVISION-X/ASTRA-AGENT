import type { MouseClickAbilityInput, MouseClickChildCapabilityId } from "../contract.js";
import { MouseClickAbilityInputSchema } from "../schema.js";
import { buildMouseClickExecutionSeed, type MouseClickExecutionSeed } from "./mouse-click-execution-seed.js";
import { buildInvalidInputFailureEnvelope, type MouseClickFailureEnvelope } from "./mouse-click-failure-seed.js";

export type MouseClickResultSeed = MouseClickExecutionSeed | MouseClickFailureEnvelope;

function formatParseIssues(input: unknown): string {
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Mouse Click rejected invalid input schema.";
  }

  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`)
    .join(" | ");
}

export function parseMouseClickAbilityInput(input: MouseClickAbilityInput | unknown):
  | { success: true; data: ParsedMouseClickAbilityInput }
  | { success: false; statusMessage: string } {
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return parsed;
  }
  return {
    success: false,
    statusMessage: `Mouse Click rejected invalid input schema. ${formatParseIssues(input)}`,
  };
}

export { buildInvalidInputFailureEnvelope, buildMouseClickExecutionSeed };
export type { MouseClickExecutionSeed, MouseClickFailureEnvelope };

export function resolveMouseClickFailureSeed(input: unknown, fallbackChildCapabilityId?: MouseClickChildCapabilityId): MouseClickResultSeed {
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return buildMouseClickExecutionSeed(parsed.data);
  }

  return buildInvalidInputFailureEnvelope(input, fallbackChildCapabilityId);
}