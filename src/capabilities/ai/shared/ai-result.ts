import type { AiAbilityResult } from "../contract.js";

export function summarizeAiResult(result: AiAbilityResult): string {
  if (result.taskType === "product_presence_judgment") {
    return `${result.taskType}:${String((result.output as { isProductVideo?: boolean | null }).isProductVideo ?? null)}`;
  }

  return `${result.taskType}:${result.confidence === null ? "null" : result.confidence.toFixed(2)}`;
}