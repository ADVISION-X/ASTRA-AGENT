import type { ProductGptChildResult } from "../../capabilities/gpt/index.js";
import { executionFailure } from "../../lib/execution-failure.js";

export const SEO_PROVIDER_PROBE_BUDGET_MS = 3_600_000;
export type SeoConfirmedSubmit = ProductGptChildResult<"submit_exact_gpt_turn_once">;

export const isConfirmedProviderSubmit = (
  submit: SeoConfirmedSubmit | null,
): submit is SeoConfirmedSubmit => Boolean(
  submit?.effectReceipt?.effectScope === "provider_effect"
  && submit.effectReceipt.outcome === "CONFIRMED"
  && submit.effectReceipt.mutationOutcome === "confirmed"
  && /^sha256:[a-f0-9]{64}$/u.test(submit.effectReceipt.providerEffectIdentityHash ?? "")
  && submit.effectReceipt.terminalAt,
);

export const executeAndReadConfirmedSubmit = async (input: Readonly<{
  read(): Promise<SeoConfirmedSubmit | null>;
  prepare(): Promise<void>;
  execute(): Promise<SeoConfirmedSubmit>;
}>): Promise<SeoConfirmedSubmit> => {
  const prior = await input.read();
  if (prior) return requireConfirmedProviderSubmit(prior);
  await input.prepare();
  return requireConfirmedProviderSubmit(await input.execute());
};

const requireConfirmedProviderSubmit = (submit: SeoConfirmedSubmit): SeoConfirmedSubmit => {
  if (!isConfirmedProviderSubmit(submit)) {
    throw executionFailure("failed", "SEO_PROVIDER_SUBMIT_NOT_CONFIRMED");
  }
  return submit;
};
