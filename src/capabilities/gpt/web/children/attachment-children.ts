import { executionFailure, failureCode } from "../../../../lib/typed-failure.js";

import type { GptAnyChildCapabilityIntent } from "../../contract.js";
import { gptAttachmentProviderDisplayName } from "../../schema.js";
import type { GptChildHandlerMap } from "../child-handler.js";
import {
  arrayInput,
  declaredFacts,
  numberInput,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_ATTACHMENT_READY_ICON_SELECTOR,
  GPT_ATTACHMENT_REGION_SELECTOR,
  GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
  GPT_UPLOAD_FROM_COMPUTER_LABEL,
  GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
} from "../contracts/attachment.contract.js";

type ApprovedFile = Readonly<{
  artifactRef: string;
  displayName: string;
  providerDisplayName: string;
  sha256: `sha256:${string}`;
  bytes: number;
}>;

type AttachmentSetState = Readonly<{
  regionCount: number;
  observedLabels: readonly string[];
  readyCount: number;
  uploadingCount: number;
  facts: GptCoherentFactProjection;
}>;

type AttachmentControlState = Readonly<{
  controlRaw: number;
  controlEligible: number;
  choiceRaw: number;
  choiceEligible: number;
  facts: GptCoherentFactProjection;
}>;

const attachmentControlState = async (
  browser: ReturnType<typeof requireBrowser>,
): Promise<AttachmentControlState> => {
  const observation = await readCoherentObservation(browser, [
    {
      queryId: "attachment-control", selector: GPT_ATTACHMENT_CONTROL_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 2, fields: ["disabled", "ariaDisabled"],
    },
    {
      queryId: "upload-choice", selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
      textEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL, maxMatches: 2, fields: [],
    },
  ]);
  const control = observation.rows.find((row) => row.queryId === "attachment-control")!;
  const choice = observation.rows.find((row) => row.queryId === "upload-choice")!;
  return Object.freeze({
    controlRaw: control.rawCount,
    controlEligible: control.eligibleCount,
    choiceRaw: choice.rawCount,
    choiceEligible: choice.eligibleCount,
    facts: projectCoherentObservation(observation, "attachment-control"),
  });
};

const filesFromIntent = (intent: GptAnyChildCapabilityIntent): readonly ApprovedFile[] => {
  const files = arrayInput(intent, "files").map((value): ApprovedFile => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
    }
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join("|") !== "artifactRef|bytes|displayName|sha256"
      || typeof item.artifactRef !== "string" || item.artifactRef.length === 0
      || typeof item.displayName !== "string" || item.displayName.length === 0
      || typeof item.sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.sha256)
      || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
    }
    const displayName = item.displayName.normalize("NFC");
    return {
      artifactRef: item.artifactRef,
      displayName,
      providerDisplayName: gptAttachmentProviderDisplayName(displayName, intent.attemptId, item.artifactRef),
      sha256: item.sha256 as `sha256:${string}`,
      bytes: item.bytes,
    };
  });
  const names = files.map((file) => file.displayName);
  if (new Set(names).size !== names.length) throw executionFailure("failed", "GPT_ATTACHMENT_DISPLAY_NAME_DUPLICATE");
  return files;
};

const attachmentSetState = async (
  browser: ReturnType<typeof requireBrowser>,
  includeReady = true,
): Promise<AttachmentSetState> => {
  const specs = [
    { queryId: "attachment-region", selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR, maxMatches: 20, fields: ["ariaLabel" as const] },
    ...(includeReady ? [
      { queryId: "attachment-ready", selector: GPT_ATTACHMENT_READY_ICON_SELECTOR, maxMatches: 20, fields: [] },
      { queryId: "attachment-uploading", selector: GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR, maxMatches: 20, fields: [] },
    ] : []),
  ] as const;
  const observation = await readCoherentObservation(browser, specs);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const regionCount = row("attachment-region").eligibleCount;
  const facts = projectCoherentObservation(observation, "attachment-region");
  if (regionCount === 0) return Object.freeze({
    regionCount, observedLabels: [], readyCount: 0, uploadingCount: 0, facts,
  });
  if (regionCount !== 1) throw executionFailure("failed", `GPT_ATTACHMENT_REGION_COUNT_${regionCount}`);
  const observedLabels = row("attachment-items").matches.map((match) => {
    if (typeof match.ariaLabel !== "string") throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    return match.ariaLabel.normalize("NFC");
  });
  return Object.freeze({
    regionCount,
    observedLabels,
    readyCount: includeReady ? row("attachment-ready").eligibleCount : 0,
    uploadingCount: includeReady ? row("attachment-uploading").eligibleCount : 0,
    facts,
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

const attachmentValue = (files: readonly ApprovedFile[]) => ({
  files: files.map(({ artifactRef, displayName, providerDisplayName, sha256, bytes }) => ({
    artifactRef, displayName, providerDisplayName, sha256, bytes,
  })),
});

const observeExactAttachmentSet = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
) => {
  const observed = await attachmentSetState(browser, false);
  if (files.length === 0) {
    if (observed.regionCount !== 0) throw executionFailure("failed", `GPT_ATTACHMENT_REGION_COUNT_${observed.regionCount}`);
    return success({
      value: { files: [] },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  const { expectedLabels, missing, unexpected } = attachmentSetDifference(files, observed.observedLabels);
  if (observed.observedLabels.length !== expectedLabels.length || missing.length > 0 || unexpected.length > 0) {
    throw executionFailure("failed", `GPT_ATTACHMENT_SET_MISMATCH:${[...missing, ...unexpected].join("|")}`);
  }
  return success({
    value: attachmentValue(files),
    ...declaredFacts({
      ...observed.facts, decision: "DONE", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: null,
    }),
  });
};

const waitForUploadedAttachmentSet = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
  timeoutMs: number,
  signal?: AbortSignal,
) => {
  if (files.length === 0) return observeExactAttachmentSet(browser, files);
  const deadline = Date.now() + timeoutMs;
  let last: AttachmentSetState = Object.freeze({
    regionCount: 0, observedLabels: [], readyCount: 0, uploadingCount: 0,
    facts: Object.freeze({
      factResultIds: [], candidateCardinality: { raw: 0, eligible: 0 },
      authorityRefHashes: [], observationRevisionHash: `sha256:${"0".repeat(64)}`,
    }),
  });
  while (true) {
    if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    try {
      last = await attachmentSetState(browser);
    } catch (error) {
      if (failureCode(error) !== "BROWSER_DOM_NODE_STALE") throw error;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw executionFailure("failed", `GPT_ATTACHMENT_UPLOAD_TIMEOUT:ready=${last.readyCount}:uploading=${last.uploadingCount}:expected=${files.length}`);
      }
      await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
      continue;
    }
    const { expectedLabels, missing, unexpected } = attachmentSetDifference(files, last.observedLabels);
    if (unexpected.length > 0 || last.observedLabels.length > expectedLabels.length) {
      throw executionFailure("failed", `GPT_ATTACHMENT_SET_MISMATCH:${[...missing, ...unexpected].join("|")}`);
    }
    const exactSet = last.regionCount === 1
      && last.observedLabels.length === expectedLabels.length
      && missing.length === 0;
    if (last.readyCount > last.observedLabels.length || last.uploadingCount > last.observedLabels.length) {
      throw executionFailure("failed", "GPT_ATTACHMENT_VISIBILITY_COUNT_INVALID");
    }
    if (exactSet && last.readyCount === expectedLabels.length && last.uploadingCount === 0) {
      return success({
        value: attachmentValue(files),
        ...declaredFacts({
          ...last.facts, decision: "DONE", mutationOutcome: "no",
          browserFact: null, nativeFailureCode: null,
        }),
      });
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw executionFailure("failed", `GPT_ATTACHMENT_UPLOAD_TIMEOUT:ready=${last.readyCount}:uploading=${last.uploadingCount}:expected=${files.length}`);
    }
    await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
  }
};

export const attachmentChildHandlers = {
  async open_gpt_attachment_control(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const observed = await attachmentControlState(browser);
    if (observed.choiceRaw === 1 && observed.choiceEligible === 1) return success({
      value: { state: "upload-choice-ready" },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
    if (observed.choiceRaw !== 0 || observed.choiceEligible !== 0) {
      throw executionFailure(
        "failed",
        `GPT_UPLOAD_CHOICE_INVALID:raw=${observed.choiceRaw}:eligible=${observed.choiceEligible}`,
      );
    }
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_ATTACHMENT_CONTROL_OPEN_PENDING");
    if (observed.controlRaw !== 1 || observed.controlEligible !== 1) {
      throw executionFailure(
        "failed",
        `GPT_ATTACHMENT_CONTROL_INVALID:raw=${observed.controlRaw}:eligible=${observed.controlEligible}`,
      );
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_ATTACHMENT_CONTROL_SELECTOR, expectedMatches: 1,
      postClickMatch: {
        selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
        textEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL,
        expectedMatches: 1,
        timeoutMs: 5_000,
      },
    });
    const readback = await attachmentControlState(browser);
    if (readback.choiceRaw !== 1 || readback.choiceEligible !== 1) {
      throw executionFailure("failed", "GPT_ATTACHMENT_CONTROL_OPEN_PENDING");
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { state: "upload-choice-ready" },
      ...declaredFacts({
        ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  },

  async attach_approved_gpt_files_once(intent, context) {
    requireExactInputKeys(intent, ["files"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    if (files.length > 0) throw executionFailure("failed", "GPT_ATTACHMENT_BROWSER_ARTIFACT_GRANT_REQUIRED");
    const readback = await observeExactAttachmentSet(browser, files);
    return success({ ...readback, value: { files: [], mutationSent: false } });
  },

  async reconcile_gpt_attachment_set(intent, context) {
    requireExactInputKeys(intent, ["files", "timeoutMs"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    const timeoutMs = Math.max(1_000, numberInput(intent, "timeoutMs"));
    return waitForUploadedAttachmentSet(browser, files, timeoutMs, context.signal);
  },
} satisfies GptChildHandlerMap;
