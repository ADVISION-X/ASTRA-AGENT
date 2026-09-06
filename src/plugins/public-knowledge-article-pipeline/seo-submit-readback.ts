import type { ExactGptCallFacts } from "../../capabilities/gpt/index.js";
import type { ProductionHash } from "../../mediator/product-plugin-contract.js";
import { postSubmitReadbackFault } from "../../mediator/product-plugin-contract.js";
import {
  executionFailureMetadata,
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

export const preservePostSubmitReadback = (error: unknown, submit: SeoConfirmedSubmit): never => {
  const typed = executionFailureMetadata(error);
  const code = failureCode(error);
  if (!typed || typed.mutationOutcome === "dispatched" || code.startsWith("GPT_PROVIDER_TERMINAL_")) throw error;
  const evidence = postSubmitEvidence(submit);
  if (!evidence) throw error;
  throw postSubmitReadbackFault(code, {
    causeCode: code,
    exactCallIdentityHash: submit.exactCallIdentityHash,
    terminalAt: evidence.terminalAt,
    evidenceRef: evidence.evidenceRef,
    evidenceHash: evidence.evidenceHash,
  });
};
