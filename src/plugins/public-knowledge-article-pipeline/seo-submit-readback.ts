import {
  confirmedProviderSubmitReceiptFromError,
  type ExactGptCallFacts,
} from "../../capabilities/gpt/index.js";
import type { ProductionHash } from "../../mediator/product-plugin-contract.js";
import { postSubmitReadbackFault } from "../../mediator/product-plugin-contract.js";
import {
  failureCode,
} from "../../lib/execution-failure.js";
export const SEO_PROVIDER_PROBE_BUDGET_MS = 3_600_000;

export type SeoConfirmedSubmit = ExactGptCallFacts;

const postSubmitEvidence = (submit: SeoConfirmedSubmit): Readonly<{
  terminalAt: string;
  evidenceRef: string;
  evidenceHash: ProductionHash;
}> | null => {
  const factsMatch = [
    submit.mutation?.owner === "browser",
    submit.mutation?.effectScope === "provider_effect",
    submit.mutation?.outcome === "CONFIRMED",
    submit.evidence?.owner === "forensics-persistence",
    submit.evidence?.readbackVerified === true,
    Boolean(submit.mutation?.terminalAt),
    Boolean(submit.evidence?.evidenceRef),
    Boolean(submit.evidence?.evidenceHash),
  ].every(Boolean);
  if (!factsMatch) return null;
  return Object.freeze({
    terminalAt: submit.mutation!.terminalAt!,
    evidenceRef: submit.evidence!.evidenceRef,
    evidenceHash: submit.evidence!.evidenceHash,
  });
};

export const preservePostSubmitReadback = (
  error: unknown,
  submit: SeoConfirmedSubmit | null,
): never => {
  const carried = confirmedProviderSubmitReceiptFromError(error);
  const code = failureCode(error);
  const evidence = carried ?? (submit ? postSubmitEvidence(submit) : null);
  if (!evidence || code.startsWith("GPT_PROVIDER_TERMINAL_")) throw error;
  throw postSubmitReadbackFault(code, {
    causeCode: code,
    exactCallIdentityHash: carried?.exactCallIdentityHash ?? submit!.exactCallIdentityHash,
    terminalAt: evidence.terminalAt,
    evidenceRef: evidence.evidenceRef,
    evidenceHash: evidence.evidenceHash,
  });
};

export const executeAndReadConfirmedSubmit = async (input: Readonly<{
  execute(): Promise<unknown>;
  readFacts(): Promise<SeoConfirmedSubmit>;
}>): Promise<SeoConfirmedSubmit> => {
  let executionError: unknown = null;
  try {
    await input.execute();
  } catch (error) {
    if (confirmedProviderSubmitReceiptFromError(error)) {
      return preservePostSubmitReadback(error, null);
    }
    executionError = error;
  }
  let submit: SeoConfirmedSubmit;
  try {
    submit = await input.readFacts();
  } catch (readbackError) {
    if (confirmedProviderSubmitReceiptFromError(readbackError)) {
      return preservePostSubmitReadback(readbackError, null);
    }
    if (executionError) throw executionError;
    throw readbackError;
  }
  if (executionError) return preservePostSubmitReadback(executionError, submit);
  return submit;
};
