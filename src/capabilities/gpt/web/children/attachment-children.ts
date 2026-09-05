import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import type { BrowserDomObservationQuery } from "../../../../lib/browser/browser-authority-api.js";
import type { GptAnyChildCapabilityIntent, GptChildBrowserFact } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
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
import { decodeCoherentObservationPacket, projectCoherentObservation, readCoherentObservation,
  type GptCoherentObservation, type GptCoherentObservationRow, type GptCoherentFactProjection,
} from "../gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR, GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_ATTACHMENT_ITEM_SELECTOR, GPT_ATTACHMENT_PENDING_ACTION_SELECTOR,
  GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR, GPT_COMPOSER_FORM_SELECTOR,
  GPT_FILE_INPUT_SELECTOR, GPT_UPLOAD_FROM_COMPUTER_LABEL, GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
} from "../contracts/attachment.contract.js";

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

type AttachmentControlState = Readonly<{
  controlRaw: number; controlEligible: number; choiceRaw: number; choiceEligible: number;
  targetRefHash: `sha256:${string}`; documentRefHash: `sha256:${string}`;
  rows: readonly GptCoherentObservationRow[]; facts: GptCoherentFactProjection;
}>;

const ATTACHMENT_CONTROL_HYDRATION_TIMEOUT_MS = 5_000;
const ATTACHMENT_CONTROL_QUERIES = Object.freeze([
  {
    queryId: "attachment-control", selector: GPT_ATTACHMENT_CONTROL_SELECTOR,
    scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 2,
    fields: ["disabled", "ariaDisabled"] as const,
  },
  {
    queryId: "upload-choice", selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
    scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR },
    textEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL, maxMatches: 2, fields: [],
  },
] satisfies readonly BrowserDomObservationQuery[]);

const ATTACHMENT_CONTROL_OPEN_POSTCONDITION = Object.freeze({
  queries: Object.freeze(ATTACHMENT_CONTROL_QUERIES.map((query) => Object.freeze({
    ...query,
    expectedEligibleCount: 1,
  }))),
  timeoutMs: ATTACHMENT_CONTROL_HYDRATION_TIMEOUT_MS,
});

const projectAttachmentControlState = (
  observation: GptCoherentObservation,
): AttachmentControlState => {
  const control = observation.rows.find((row) => row.queryId === "attachment-control")!;
  const choice = observation.rows.find((row) => row.queryId === "upload-choice")!;
  return Object.freeze({
    controlRaw: control.rawCount,
    controlEligible: control.eligibleCount,
    choiceRaw: choice.rawCount,
    choiceEligible: choice.eligibleCount,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "upload-choice"),
  });
};

const attachmentControlState = async (
  browser: ReturnType<typeof requireBrowser>,
): Promise<AttachmentControlState> => projectAttachmentControlState(
  await readCoherentObservation(browser, ATTACHMENT_CONTROL_QUERIES),
);

const attachmentRow = (value: AttachmentControlState, queryId: string): GptCoherentObservationRow =>
  value.rows.find((row) => row.queryId === queryId)!;

const attachmentRowCode = (row: GptCoherentObservationRow): string => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
};

const attachmentControlCode = (value: AttachmentControlState): string =>
  `revision=${value.facts.observationRevisionHash}:candidates=${value.rows.map(attachmentRowCode).join("|")}`;

const attachmentNativeCause = (value: AttachmentControlState): string | null =>
  value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;

const attachmentSetCode = (value: AttachmentSetState): string =>
  `revision=${value.facts.observationRevisionHash}:candidates=${value.rows.map(attachmentRowCode).join("|")}`;

const attachmentSetNativeCause = (value: AttachmentSetState): string | null =>
  value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;

const failAttachmentControl = (
  code: string,
  value: AttachmentControlState,
  browserFact: GptChildBrowserFact | null = null,
): never => {
  const mutationOutcome = browserFact?.mutationOutcome ?? "no";
  const nativeFailureCode = attachmentNativeCause(value);
  throw gptExecutionFailure(`${code}:${attachmentControlCode(value)}`, {
    mutationOutcome,
    ...(browserFact ? {
      browserEffect: Object.freeze({
        effectScope: browserFact.effectScope,
        childCapabilityId: browserFact.childCapabilityId,
        browserOutcome: browserFact.browserOutcome,
      }),
    } : {}),
    proofFacts: Object.freeze({
      ...value.facts,
      decision: "FAIL_CLOSED",
      mutationOutcome,
      browserFact,
      nativeFailureCode,
    }),
  });
};

const failAttachmentSet = (code: string, value: AttachmentSetState): never => {
  const nativeFailureCode = attachmentSetNativeCause(value);
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

const attachmentControlFullyAbsent = (value: AttachmentControlState): boolean => {
  const control = attachmentRow(value, "attachment-control");
  const choice = attachmentRow(value, "upload-choice");
  const composerScopeHydrated = (control.scopeRawCount === 0 && control.scopeEligibleCount === 0)
    || (control.scopeRawCount === 1 && control.scopeEligibleCount === 1);
  return composerScopeHydrated && control.rawCount === 0 && control.eligibleCount === 0
    && choice.scopeEligibleCount === 0 && choice.rawCount === 0 && choice.eligibleCount === 0;
};

const attachmentControlOpenable = (value: AttachmentControlState): boolean => {
  const control = attachmentRow(value, "attachment-control");
  const choice = attachmentRow(value, "upload-choice");
  return control.scopeRawCount === 1 && control.scopeEligibleCount === 1
    && control.rawCount === 1 && control.eligibleCount === 1
    && choice.scopeEligibleCount === 0 && choice.rawCount === 0 && choice.eligibleCount === 0;
};

const attachmentControlReady = (value: AttachmentControlState): boolean => {
  const control = attachmentRow(value, "attachment-control");
  const choice = attachmentRow(value, "upload-choice");
  return control.scopeRawCount === 1 && control.scopeEligibleCount === 1
    && control.rawCount === 1 && control.eligibleCount === 1
    && choice.scopeEligibleCount === 1 && choice.rawCount >= 1 && choice.eligibleCount === 1
    && choice.scopeRejections.every((entry) => entry.reasons.length > 0)
    && choice.rejections.every((entry) => entry.reasons.length === 1 && entry.reasons[0] === "TEXT_MISMATCH");
};

const waitForAttachmentControlHydration = async (
  browser: ReturnType<typeof requireBrowser>,
  signal?: AbortSignal,
): Promise<AttachmentControlState> => {
  const deadline = Date.now() + ATTACHMENT_CONTROL_HYDRATION_TIMEOUT_MS;
  let observed = await attachmentControlState(browser);
  const targetRefHash = observed.targetRefHash;
  const documentRefHash = observed.documentRefHash;
  while (attachmentControlFullyAbsent(observed)) {
    if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    const remaining = deadline - Date.now();
    if (remaining <= 0) failAttachmentControl("GPT_ATTACHMENT_CONTROL_HYDRATION_TIMEOUT", observed);
    await browser.wait({
      durationMs: Math.min(remaining, Math.max(25, Math.min(250, Math.ceil(remaining / 20)))),
    });
    observed = await attachmentControlState(browser);
    if (observed.targetRefHash !== targetRefHash || observed.documentRefHash !== documentRefHash) {
      failAttachmentControl("GPT_ATTACHMENT_CONTROL_HYDRATION_DOCUMENT_CHANGED", observed);
    }
  }
  return observed;
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
      || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 1) {
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
  includeUploadState = true,
): Promise<AttachmentSetState> => {
  const specs = [
    { queryId: "attachment-composer", selector: GPT_COMPOSER_FORM_SELECTOR, maxMatches: 2, fields: [] },
    {
      queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: ["ariaLabel" as const],
    },
    ...(includeUploadState ? [
      {
        queryId: "attachment-uploading", selector: GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR,
        scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: [],
      },
      {
        queryId: "attachment-pending", selector: GPT_ATTACHMENT_PENDING_ACTION_SELECTOR,
        scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: [],
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
    uploadingCount: includeUploadState ? row("attachment-uploading").eligibleCount : 0,
    pendingActionCount: includeUploadState ? row("attachment-pending").eligibleCount : 0,
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
  if (observed.composerRawCount !== 1 || observed.composerEligibleCount !== 1) {
    failAttachmentSet("GPT_ATTACHMENT_COMPOSER_INVALID", observed);
  }
  if (files.length === 0) {
    if (observed.itemRawCount !== 0 || observed.itemEligibleCount !== 0) {
      failAttachmentSet("GPT_ATTACHMENT_SET_MISMATCH", observed);
    }
    return success({
      value: { files: [] },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
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

const waitForUploadedAttachmentSet = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
  timeoutMs: number,
  signal?: AbortSignal,
) => {
  if (files.length === 0) return observeExactAttachmentSet(browser, files);
  const deadline = Date.now() + timeoutMs;
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
      last = await attachmentSetState(browser);
    } catch (error) {
      if (failureCode(error) !== "BROWSER_DOM_NODE_STALE") throw error;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        failAttachmentSet(`GPT_ATTACHMENT_UPLOAD_TIMEOUT:cards=${last.itemEligibleCount}:uploading=${last.uploadingCount}:pending=${last.pendingActionCount}:expected=${files.length}`, last);
      }
      await browser.wait({
        durationMs: Math.min(remaining, Math.max(1, Math.min(500, Math.ceil(remaining / 20)))),
      });
      continue;
    }
    const { expectedLabels, missing, unexpected } = attachmentSetDifference(files, last.observedLabels);
    if (last.composerRawCount > 1 || last.composerEligibleCount > 1
      || (last.composerRawCount > 0 && last.composerRawCount !== last.composerEligibleCount)) {
      failAttachmentSet("GPT_ATTACHMENT_COMPOSER_INVALID", last);
    }
    if (last.itemRawCount > expectedLabels.length
      || last.itemEligibleCount > expectedLabels.length
      || new Set(last.observedLabels).size !== last.observedLabels.length
      || unexpected.length > 0) {
      failAttachmentSet("GPT_ATTACHMENT_SET_MISMATCH", last);
    }
    if (last.uploadingCount > last.itemEligibleCount || last.pendingActionCount > last.itemEligibleCount) {
      failAttachmentSet("GPT_ATTACHMENT_VISIBILITY_COUNT_INVALID", last);
    }
    if (attachmentSetReady(last, expectedLabels.length, missing.length)) {
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
      failAttachmentSet(`GPT_ATTACHMENT_UPLOAD_TIMEOUT:cards=${last.itemEligibleCount}:uploading=${last.uploadingCount}:pending=${last.pendingActionCount}:expected=${files.length}`, last);
    }
    await browser.wait({
      durationMs: Math.min(remaining, Math.max(1, Math.min(500, Math.ceil(remaining / 20)))),
    });
  }
};

export const attachmentChildHandlers = {
  async open_gpt_attachment_control(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const observed = await waitForAttachmentControlHydration(browser, context.signal);
    if (attachmentControlReady(observed)) return success({
      value: { state: "upload-choice-ready" },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
    if (!attachmentControlOpenable(observed)) {
      failAttachmentControl("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID", observed);
    }
    if (context.mutationMode === "readback") {
      failAttachmentControl("GPT_ATTACHMENT_CONTROL_OPEN_PENDING", observed);
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_ATTACHMENT_CONTROL_SELECTOR, expectedMatches: 1,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR },
      postClickObservation: ATTACHMENT_CONTROL_OPEN_POSTCONDITION,
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const readback = projectAttachmentControlState(decodeCoherentObservationPacket(
      mutationRecord.postconditionObservation,
      ATTACHMENT_CONTROL_QUERIES,
    ));
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    if (!attachmentControlReady(readback)) {
      failAttachmentControl("GPT_ATTACHMENT_CONTROL_OPEN_PENDING", readback, browserFact);
    }
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
    if (files.length === 0 || context.mutationMode === "readback") {
      const readback = await observeExactAttachmentSet(browser, files);
      return success({
        value: { files: readback.value.files, mutationSent: false },
        ...declaredFacts({
          decision: "DONE",
          factResultIds: readback.factResultIds,
          candidateCardinality: readback.candidateCardinality,
          authorityRefHashes: readback.authorityRefHashes,
          observationRevisionHash: readback.observationRevisionHash,
          mutationOutcome: "no", browserFact: null, nativeFailureCode: null,
        }),
      });
    }
    const control = await attachmentControlState(browser);
    if (!attachmentControlReady(control)) {
      failAttachmentControl("GPT_UPLOAD_CHOICE_INVALID", control);
    }
    await browser.attachFile({
      selector: GPT_FILE_INPUT_SELECTOR,
      activation: {
        selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
        scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR },
        expectedTextEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL,
      },
      approvedArtifacts: files.map((file) => ({
        artifactRef: file.artifactRef,
        providerDisplayName: file.providerDisplayName,
        expectedSha256: file.sha256,
        bytes: file.bytes,
      })),
    });
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { ...attachmentValue(files), mutationSent: true },
      ...declaredFacts({
        ...control.facts, decision: "ACT",
        factResultIds: Object.freeze([...control.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...control.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  },

  async reconcile_gpt_attachment_set(intent, context) {
    requireExactInputKeys(intent, ["files", "timeoutMs"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    const timeoutMs = Math.max(1_000, numberInput(intent, "timeoutMs"));
    return waitForUploadedAttachmentSet(browser, files, timeoutMs, context.signal);
  },
} satisfies GptChildHandlerMap;
