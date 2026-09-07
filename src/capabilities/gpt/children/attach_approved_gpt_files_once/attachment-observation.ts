import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { gptAttachmentProviderDisplayName } from "../../schema.js";
import {
  arrayInput,
  declaredFacts,
  requireBrowser,
  success,
} from "../../web/child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentObservationRow,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
} from "./selectors.js";

type ApprovedFile = Readonly<{
  artifactRef: string; displayName: string; providerDisplayName: string;
  sha256: `sha256:${string}`; bytes: number;
}>;

type AttachmentSetState = Readonly<{
  composerRawCount: number; composerEligibleCount: number;
  itemRawCount: number; itemEligibleCount: number; observedLabels: readonly string[];
  rows: readonly GptCoherentObservationRow[]; facts: GptCoherentFactProjection;
}>;

export const attachmentObservationRowsCode = (
  rows: readonly GptCoherentObservationRow[],
): string => rows.map((row) => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
}).join("|");

const attachmentSetCode = (value: AttachmentSetState): string =>
  `revision=${value.facts.observationRevisionHash}:candidates=${attachmentObservationRowsCode(value.rows)}`;

const failAttachmentSet = (code: string, value: AttachmentSetState): never => {
  const nativeFailureCode = value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;
  throw gptExecutionFailure(`${code}:${attachmentSetCode(value)}`, {
    mutationOutcome: "no",
    proofFacts: Object.freeze({
      ...value.facts,
      decision: "FAIL_CLOSED",
      mutationOutcome: "no",
      browserFact: null,
      nativeFailureCode,
    }),
  });
};

export const filesFromIntent = (
  intent: GptChildCapabilityIntent<"attach_approved_gpt_files_once">,
): readonly ApprovedFile[] => {
  const files = arrayInput(intent, "files").map((value): ApprovedFile => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
    }
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join("|") !== "artifactRef|bytes|displayName|sha256"
      || typeof item.artifactRef !== "string" || item.artifactRef.length === 0
      || typeof item.displayName !== "string" || item.displayName.length === 0
      || typeof item.sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.sha256)
      || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 1) {
      throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
    }
    const displayName = item.displayName.normalize("NFC");
    return {
      artifactRef: item.artifactRef,
      displayName,
      providerDisplayName: gptAttachmentProviderDisplayName(displayName, intent.jobId, item.artifactRef),
      sha256: item.sha256 as `sha256:${string}`,
      bytes: item.bytes,
    };
  });
  const names = files.map((file) => file.displayName);
  if (new Set(names).size !== names.length) {
    throw executionFailure("failed", "GPT_ATTACHMENT_DISPLAY_NAME_DUPLICATE");
  }
  return files;
};

const attachmentSetState = async (
  browser: ReturnType<typeof requireBrowser>,
): Promise<AttachmentSetState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "attachment-composer", selector: GPT_COMPOSER_FORM_SELECTOR, maxMatches: 2, fields: [] },
    {
      queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: ["ariaLabel" as const],
    },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const observedLabels = row("attachment-items").matches.map((match) => {
    if (typeof match.ariaLabel !== "string") throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    return match.ariaLabel.normalize("NFC");
  });
  return Object.freeze({
    composerRawCount: row("attachment-composer").rawCount,
    composerEligibleCount: row("attachment-composer").eligibleCount,
    itemRawCount: row("attachment-items").rawCount,
    itemEligibleCount: row("attachment-items").eligibleCount,
    observedLabels,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "attachment-items"),
  });
};

const attachmentSetDifference = (
  files: readonly ApprovedFile[],
  observedLabels: readonly string[],
) => {
  const expectedLabels = files.map((file) => file.providerDisplayName);
  const missing = expectedLabels.filter((label) => !observedLabels.includes(label));
  const unexpected = observedLabels.filter((label) => !expectedLabels.includes(label));
  return Object.freeze({ expectedLabels, missing, unexpected });
};

export const attachmentValue = (files: readonly ApprovedFile[]) => ({
  files: files.map(({ artifactRef, displayName, providerDisplayName, sha256, bytes }) => ({
    artifactRef, displayName, providerDisplayName, sha256, bytes,
  })),
});

export const observeExactAttachmentSet = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
) => {
  const observed = await attachmentSetState(browser);
  if (observed.composerRawCount !== 1 || observed.composerEligibleCount !== 1) {
    failAttachmentSet("GPT_ATTACHMENT_COMPOSER_INVALID", observed);
  }
  const { expectedLabels, missing, unexpected } = attachmentSetDifference(files, observed.observedLabels);
  if (observed.itemRawCount !== expectedLabels.length
    || observed.itemEligibleCount !== expectedLabels.length
    || observed.observedLabels.length !== expectedLabels.length
    || new Set(observed.observedLabels).size !== observed.observedLabels.length
    || missing.length > 0 || unexpected.length > 0) {
    failAttachmentSet("GPT_ATTACHMENT_SET_MISMATCH", observed);
  }
  return success({
    value: attachmentValue(files),
    ...declaredFacts({
      ...observed.facts, decision: "DONE", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: null,
    }),
  });
};

