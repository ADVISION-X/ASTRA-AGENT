import type { ProductGptChildResult } from "../../capabilities/gpt/index.js";
import { executionFailure } from "../../lib/execution-failure.js";

export const SEO_PROVIDER_PROBE_BUDGET_MS = 3_600_000;
export type SeoConfirmedSubmit = ProductGptChildResult<"submit_exact_gpt_turn_once">;

export const isConfirmedProviderSubmit = (
  submit: SeoConfirmedSubmit | null,
): submit is SeoConfirmedSubmit => Boolean(
  submit?.effectReceipt?.effectScope === "provider_effect"
  && submit.effectReceipt.outcome === "CONFIRMED"
  && submit.effectReceipt.terminalAt,
);

export const executeAndReadConfirmedSubmit = async (input: Readonly<{
  execute(): Promise<SeoConfirmedSubmit>;
}>): Promise<SeoConfirmedSubmit> => {
  const submit = await input.execute();
  if (!isConfirmedProviderSubmit(submit)) {
    throw executionFailure("failed", "SEO_PROVIDER_SUBMIT_NOT_CONFIRMED");
  }
  return submit;
};
