import { MAX_BROWSER_APPROVED_FILE_BATCH } from "../../../../lib/browser/browser-authority-api.js";
import { parse } from "node:path";

import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import {
  gptAttachmentProviderDisplayName,
  normalizeGptProviderAttachmentLabel,
} from "../../schema.js";
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
  GPT_ATTACHMENT_PENDING_ACTION_SELECTOR,
  GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
} from "./selectors.js";

type ApprovedFile = Readonly<{
  artifactRef: string; displayName: string; providerDisplayName: string;
  sha256: `sha256:${string}`; bytes: number;
}>;

type AttachmentSetState = Readonly<{
  composerRawCount: number; composerEligibleCount: number;
  itemRawCount: number; itemEligibleCount: number; observedLabels: readonly string[];
  uploadingCount: number; pendingActionCount: number;
  rows: readonly GptCoherentObservationRow[]; facts: GptCoherentFactProjection;
}>;

const attachmentObservationRowsCode = (
  rows: readonly GptCoherentObservationRow[],
): string => rows.map((row) => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
}).join("|");

const attachmentSetCode = (value: AttachmentSetState): string =>
  `revision=${value.facts.observationRevisionHash}:candidates=${attachmentObservationRowsCode(value.rows)}`;

const failAttachmentSet = (code: string, value: AttachmentSetState, labelsCode = ""): never => {
  const nativeFailureCode = value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;
  throw gptExecutionFailure(`${code}:${attachmentSetCode(value)}${labelsCode}`, {
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
  intent: GptChildCapabilityIntent<"reconcile_gpt_attachment_set">,
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
  observationMode: "set-only" | "upload-settlement",
): Promise<AttachmentSetState> => {
  const specs = [
    { queryId: "attachment-composer", selector: GPT_COMPOSER_FORM_SELECTOR, maxMatches: 2, fields: [] },
    {
      queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: MAX_BROWSER_APPROVED_FILE_BATCH, fields: ["ariaLabel" as const],
    },
    ...(observationMode === "upload-settlement" ? [
      {
        queryId: "attachment-uploading", selector: GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR,
        scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: MAX_BROWSER_APPROVED_FILE_BATCH, fields: [],
      },
      {
        queryId: "attachment-pending", selector: GPT_ATTACHMENT_PENDING_ACTION_SELECTOR,
        scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: MAX_BROWSER_APPROVED_FILE_BATCH, fields: [],
      },
    ] : []),
  ] as const;
  const observation = await readCoherentObservation(browser, specs);
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
    uploadingCount: observationMode === "upload-settlement" ? row("attachment-uploading").eligibleCount : 0,
    pendingActionCount: observationMode === "upload-settlement" ? row("attachment-pending").eligibleCount : 0,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "attachment-items"),
  });
};

const attachmentSetDifference = (
  files: readonly ApprovedFile[],
  observedLabels: readonly string[],
) => {
  const expectedLabels = files.map((file) => file.providerDisplayName);
  const normalizedObservedLabels = observedLabels.map((label) =>
    normalizeGptProviderAttachmentLabel(label, expectedLabels));
  const missing = expectedLabels.filter((label) => !normalizedObservedLabels.includes(label));
  const unexpected = normalizedObservedLabels.filter((label) => !expectedLabels.includes(label));
  return Object.freeze({ expectedLabels, normalizedObservedLabels, missing, unexpected });
};

const LABEL_SHAPES: readonly Readonly<[string, (label: string, file: ApprovedFile) => boolean]>[] = [
  ["SPACE_PAREN_DIGITS", (label, file) => {
    const { name, ext } = parse(file.providerDisplayName);
    return label.startsWith(`${name} (`) && label.endsWith(`)${ext}`)
      && /^\d+$/u.test(label.slice(name.length + 2, label.length - ext.length - 1));
  }],
  ["TOKEN_ABSENT", (label, file) => label === file.displayName],
  ["EXT_CHANGED", (label, file) => parse(label).name === parse(file.providerDisplayName).name
    && parse(label).ext !== parse(file.providerDisplayName).ext],
  ["PREFIX_OF_APPROVED", (label, file) => label.length > 0 && label !== file.providerDisplayName
    && file.providerDisplayName.startsWith(label)],
];

/** Closed shape codes and counts only; observed label text never leaves this function. */
const attachmentLabelsCode = (files: readonly ApprovedFile[], observedLabels: readonly string[]): string => {
  const { normalizedObservedLabels, missing, unexpected } = attachmentSetDifference(files, observedLabels);
  const duplicates = normalizedObservedLabels.length - new Set(normalizedObservedLabels).size;
  const shapes = unexpected.map((label) => LABEL_SHAPES.find(([, matches]) =>
    files.some((file) => matches(label, file)))?.[0] ?? "UNRELATED");
  return `:labels=missing:${missing.length},unexpected:${unexpected.length},dup:${duplicates}`
    + `,shape:${shapes.length > 0 ? shapes.join(",") : "none"}`;
};

const attachmentValue = (files: readonly ApprovedFile[]) => ({
  files: files.map(({ artifactRef, displayName, providerDisplayName, sha256, bytes }) => ({
    artifactRef, displayName, providerDisplayName, sha256, bytes,
  })),
});

const observeExactAttachmentSet = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
) => {
  const observed = await attachmentSetState(browser, "set-only");
  if (observed.composerRawCount !== 1 || observed.composerEligibleCount !== 1) {
    failAttachmentSet("GPT_ATTACHMENT_COMPOSER_INVALID", observed);
  }
  const { expectedLabels, normalizedObservedLabels, missing, unexpected } =
    attachmentSetDifference(files, observed.observedLabels);
  if (observed.itemRawCount !== expectedLabels.length
    || observed.itemEligibleCount !== expectedLabels.length
    || observed.observedLabels.length !== expectedLabels.length
    || new Set(normalizedObservedLabels).size !== normalizedObservedLabels.length
    || missing.length > 0 || unexpected.length > 0) {
    failAttachmentSet("GPT_ATTACHMENT_SET_MISMATCH", observed, attachmentLabelsCode(files, observed.observedLabels));
  }
  return success({
    value: attachmentValue(files),
    ...declaredFacts({
      ...observed.facts, decision: "DONE", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: null,
    }),
  });
};

const attachmentSetReady = (
  state: AttachmentSetState,
  expectedCount: number,
  missingCount: number,
): boolean => state.composerRawCount === 1
  && state.composerEligibleCount === 1
  && state.itemRawCount === expectedCount
  && state.itemEligibleCount === expectedCount
  && state.observedLabels.length === expectedCount
  && missingCount === 0
  && state.uploadingCount === 0
  && state.pendingActionCount === 0;

const assertAttachmentObservationValid = (state: AttachmentSetState): void => {
  if (state.composerRawCount > 1 || state.composerEligibleCount > 1
    || (state.composerRawCount > 0 && state.composerRawCount !== state.composerEligibleCount)) {
    failAttachmentSet("GPT_ATTACHMENT_COMPOSER_INVALID", state);
  }
  if (state.pendingActionCount > state.itemEligibleCount) {
    failAttachmentSet("GPT_ATTACHMENT_VISIBILITY_COUNT_INVALID", state);
  }
};

const attachmentSettlementTimeout = (
  state: AttachmentSetState,
  files: readonly ApprovedFile[],
): never => {
  const { expectedLabels, normalizedObservedLabels, missing, unexpected } =
    attachmentSetDifference(files, state.observedLabels);
  if (state.itemRawCount !== expectedLabels.length
    || state.itemEligibleCount !== expectedLabels.length
    || state.observedLabels.length !== expectedLabels.length
    || new Set(normalizedObservedLabels).size !== normalizedObservedLabels.length
    || missing.length > 0 || unexpected.length > 0) {
    failAttachmentSet("GPT_ATTACHMENT_SET_MISMATCH", state, attachmentLabelsCode(files, state.observedLabels));
  }
  return failAttachmentSet(
    `GPT_ATTACHMENT_UPLOAD_TIMEOUT:cards=${state.itemEligibleCount}:uploading=${state.uploadingCount}`
      + `:pending=${state.pendingActionCount}:expected=${files.length}`,
    state,
  );
};

const ATTACHMENT_OBSERVATION_INTERVALS_MS = [
  2_000, 3_000, 5_000, 7_000, 9_000, 11_000,
] as const;

const waitForNextAttachmentObservation = async (
  browser: ReturnType<typeof requireBrowser>,
  deadline: number,
  waitOrdinal: number,
): Promise<boolean> => {
  const remaining = deadline - Date.now();
  if (remaining < 1_500) return false;
  const scheduled = ATTACHMENT_OBSERVATION_INTERVALS_MS[
    Math.min(waitOrdinal, ATTACHMENT_OBSERVATION_INTERVALS_MS.length - 1)
  ]!;
  await browser.wait({
    durationMs: Math.min(remaining, Math.max(1_500, scheduled)),
  });
  return true;
};

export const waitForUploadedAttachmentSet = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
  timeoutMs: number,
  signal?: AbortSignal,
) => {
  if (files.length === 0) return observeExactAttachmentSet(browser, files);
  const deadline = Date.now() + timeoutMs;
  let waitOrdinal = 0;
  let last: AttachmentSetState = Object.freeze({
    composerRawCount: 0, composerEligibleCount: 0,
    itemRawCount: 0, itemEligibleCount: 0,
    observedLabels: [], uploadingCount: 0, pendingActionCount: 0, rows: [],
    facts: Object.freeze({
      factResultIds: [], candidateCardinality: { raw: 0, eligible: 0 },
      authorityRefHashes: [], observationRevisionHash: `sha256:${"0".repeat(64)}`,
    }),
  });
  while (true) {
    if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    try {
      last = await attachmentSetState(browser, "upload-settlement");
    } catch (error) {
      if (failureCode(error) !== "BROWSER_DOM_NODE_STALE") throw error;
      if (deadline <= Date.now()) attachmentSettlementTimeout(last, files);
      if (!await waitForNextAttachmentObservation(browser, deadline, waitOrdinal)) {
        attachmentSettlementTimeout(last, files);
      }
      waitOrdinal += 1;
      continue;
    }
    const { expectedLabels, missing } = attachmentSetDifference(files, last.observedLabels);
    assertAttachmentObservationValid(last);
    if (attachmentSetReady(last, expectedLabels.length, missing.length)) {
      return success({
        value: attachmentValue(files),
        ...declaredFacts({
          ...last.facts, decision: "DONE", mutationOutcome: "no",
          browserFact: null, nativeFailureCode: null,
        }),
      });
    }
    if (deadline <= Date.now()) attachmentSettlementTimeout(last, files);
    if (!await waitForNextAttachmentObservation(browser, deadline, waitOrdinal)) {
      attachmentSettlementTimeout(last, files);
    }
    waitOrdinal += 1;
  }
};
