import type { ExactGptCallFacts } from "../../capabilities/gpt/index.js";
import { executionFailure } from "../../lib/execution-failure.js";

export const SEO_PROVIDER_PROBE_BUDGET_MS = 3_600_000;
export type SeoConfirmedSubmit = ExactGptCallFacts;

export const isConfirmedProviderSubmit = (
  submit: SeoConfirmedSubmit | null,
): submit is SeoConfirmedSubmit => Boolean(
  submit?.mutation?.owner === "browser"
  && submit.mutation.effectScope === "provider_effect"
  && submit.mutation.outcome === "CONFIRMED"
  && submit.mutation.terminalAt
  && submit.evidence?.owner === "forensics-persistence"
  && submit.evidence.readbackVerified,
);

export const executeAndReadConfirmedSubmit = async (input: Readonly<{
  execute(): Promise<unknown>;
  readFacts(): Promise<SeoConfirmedSubmit>;
}>): Promise<SeoConfirmedSubmit> => {
  await input.execute();
  const submit = await input.readFacts();
  if (!isConfirmedProviderSubmit(submit)) {
    throw executionFailure("failed", "SEO_PROVIDER_SUBMIT_NOT_CONFIRMED");
  }
  return submit;
};
