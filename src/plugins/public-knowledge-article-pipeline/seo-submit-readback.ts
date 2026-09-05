import type {
  ConfirmedGptSubmitFailureReceipt,
  ExactGptCallFacts,
} from "../../capabilities/gpt/index.js";
import type { ProductionHash } from "../../mediator/product-plugin-contract.js";
import { postSubmitReadbackFault } from "../../mediator/product-plugin-contract.js";
import {
  executionFailureMetadata,
  failureCode,
} from "../../lib/execution-failure.js";
import { fail } from "./seo-turn-contract.js";

const WAIT_TIMEOUT_MS = 3_600_000;

export type SeoConfirmedSubmit = ExactGptCallFacts | ConfirmedGptSubmitFailureReceipt;

const postSubmitEvidence = (submit: SeoConfirmedSubmit): Readonly<{
  terminalAt: string;
  evidenceRef: string;
  evidenceHash: ProductionHash;
}> | null => {
  if ("terminalAt" in submit) return submit.terminalAt && submit.evidenceRef && submit.evidenceHash
    ? Object.freeze({
      terminalAt: submit.terminalAt,
      evidenceRef: submit.evidenceRef,
      evidenceHash: submit.evidenceHash,
    }) : null;
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

export const confirmedDeadline = (submit: SeoConfirmedSubmit): string => {
  const terminalAt = "terminalAt" in submit
    ? submit.terminalAt
    : submit.mutation?.outcome === "CONFIRMED" ? submit.mutation.terminalAt : null;
  if (!terminalAt) fail("SEO_PROVIDER_EFFECT_TERMINAL_FACT_MISSING");
  const confirmedAt = Date.parse(terminalAt);
  if (!Number.isFinite(confirmedAt)) fail("SEO_PROVIDER_EFFECT_TERMINAL_FACT_MISSING");
  return new Date(confirmedAt + WAIT_TIMEOUT_MS).toISOString();
};

export const preservePostSubmitReadback = (error: unknown, submit: SeoConfirmedSubmit): never => {
  const typed = executionFailureMetadata(error);
  const code = failureCode(error);
  if (!typed || typed.mutationOutcome !== "no" || code.startsWith("GPT_PROVIDER_TERMINAL_")) throw error;
  const evidence = postSubmitEvidence(submit);
  if (!evidence) throw error;
  throw postSubmitReadbackFault(code, {
    causeCode: code,
    exactCallIdentityHash: submit.exactCallIdentityHash,
    terminalAt: evidence.terminalAt,
    readbackDeadlineAt: confirmedDeadline(submit),
    evidenceRef: evidence.evidenceRef,
    evidenceHash: evidence.evidenceHash,
  });
};

export const requireConfirmedSubmitDirectFailure = (
  error: unknown,
  receipt: ConfirmedGptSubmitFailureReceipt | null,
): ConfirmedGptSubmitFailureReceipt => {
  const typed = executionFailureMetadata(error);
  const code = failureCode(error);
  if (code !== "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED"
    || typed?.mutationOutcome !== "confirmed"
    || typed.browserEffect?.effectScope !== "provider_effect"
    || typed.browserEffect.childCapabilityId !== "submit_exact_gpt_turn_once"
    || typed.browserEffect.browserOutcome !== "CONFIRMED"
    || !receipt || receipt.failureCode !== code) throw error;
  return receipt;
};

export const preserveConfirmedSubmitDirectFailure = (
  error: unknown,
  submit: ConfirmedGptSubmitFailureReceipt,
): never => {
  const receipt = requireConfirmedSubmitDirectFailure(error, submit);
  const code = receipt.failureCode;
  throw postSubmitReadbackFault(code, {
    causeCode: code,
    exactCallIdentityHash: receipt.exactCallIdentityHash,
    terminalAt: receipt.terminalAt,
    readbackDeadlineAt: confirmedDeadline(submit),
    evidenceRef: receipt.evidenceRef,
    evidenceHash: receipt.evidenceHash,
  });
};
