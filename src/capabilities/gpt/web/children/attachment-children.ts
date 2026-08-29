import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";

import type { BrowserFileArtifactGrantV1 } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import type { GptChildHandlerMap } from "../child-handler.js";
import {
  arrayInput,
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import { findCount, requireOneCandidate } from "../gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_ATTACHMENT_READY_ICON_SELECTOR,
  GPT_ATTACHMENT_REGION_SELECTOR,
  GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR,
  GPT_FILE_INPUT_SELECTOR,
  GPT_UPLOAD_FROM_COMPUTER_LABEL,
  GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
} from "../contracts/attachment.contract.js";

type ApprovedFile = Readonly<{
  artifactRef: string;
  filePath: string;
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
}>;

const digest = (bytes: Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export const gptAttachmentProviderDisplayName = (displayName: string, attemptId: string, artifactRef: string): string => {
  const parsed = parse(displayName);
  if (parsed.base !== displayName || !parsed.name) {
    throw executionFailure("failed", "GPT_ATTACHMENT_DISPLAY_NAME_INVALID");
  }
  const attemptToken = createHash("sha256")
    .update(`${attemptId}\u0000${artifactRef}`)
    .digest("hex")
    .slice(0, 12);
  return `${parsed.name}-${attemptToken}${parsed.ext}`.normalize("NFC");
};

const filesFromIntent = (intent: GptChildCapabilityIntent): readonly ApprovedFile[] => {
  const files = arrayInput(intent, "files").map((value): ApprovedFile => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
    }
    const item = value as Record<string, unknown>;
    if (typeof item.artifactRef !== "string" || item.artifactRef.length === 0
      || typeof item.filePath !== "string" || item.filePath.length === 0
      || typeof item.displayName !== "string" || item.displayName.length === 0
      || typeof item.sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.sha256)
      || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
    }
    const displayName = item.displayName.normalize("NFC");
    return {
      artifactRef: item.artifactRef,
      filePath: item.filePath,
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

const verifyFiles = async (files: readonly ApprovedFile[]): Promise<void> => {
  for (const file of files) {
    const bytes = await readFile(file.filePath);
    if (bytes.byteLength !== file.bytes || digest(bytes) !== file.sha256) {
      throw executionFailure("failed", `GPT_ATTACHMENT_SOURCE_CHANGED:${file.artifactRef}`);
    }
  }
};

const issueGrants = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
): Promise<readonly BrowserFileArtifactGrantV1[]> => {
  await verifyFiles(files);
  const grants: BrowserFileArtifactGrantV1[] = [];
  const stagingDirectory = await mkdtemp(join(tmpdir(), "grasseye-gpt-upload-"));
  try {
    for (const file of files) {
      const stagedPath = join(stagingDirectory, file.providerDisplayName);
      await copyFile(file.filePath, stagedPath);
      await browser.registerFileArtifact({
        artifactRef: file.artifactRef,
        filePath: stagedPath,
        contentHash: file.sha256,
        sizeBytes: file.bytes,
      });
      grants.push(await browser.issueFileArtifactGrant({
        artifactRef: file.artifactRef,
        expectedSha256: file.sha256,
        maxBytes: file.bytes,
      }));
    }
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
  }
  return grants;
};

const attachmentLabels = async (
  browser: ReturnType<typeof requireBrowser>,
): Promise<readonly string[]> => {
  const result = await browser.executeDomIntent({
    kind: "find",
    selector: GPT_ATTACHMENT_ITEM_SELECTOR,
    maxMatches: 20,
    fields: ["ariaLabel"],
  });
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  const observation = result as Record<string, unknown>;
  if (!Array.isArray(observation.matches)
    || !Number.isInteger(observation.count)
    || observation.count !== observation.matches.length) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return observation.matches.map((match) => {
    if (!match || typeof match !== "object" || Array.isArray(match)
      || typeof (match as Record<string, unknown>).ariaLabel !== "string") {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return (match as Record<string, unknown>).ariaLabel as string;
  });
};

const attachmentSetState = async (
  browser: ReturnType<typeof requireBrowser>,
  includeReady = true,
): Promise<AttachmentSetState> => {
  const regionCount = await findCount(browser, { selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2 });
  if (regionCount === 0) return Object.freeze({
    regionCount, observedLabels: [], readyCount: 0, uploadingCount: 0,
  });
  if (regionCount !== 1) throw executionFailure("failed", `GPT_ATTACHMENT_REGION_COUNT_${regionCount}`);
  return Object.freeze({
    regionCount,
    observedLabels: await attachmentLabels(browser),
    readyCount: includeReady
      ? await findCount(browser, { selector: GPT_ATTACHMENT_READY_ICON_SELECTOR, maxMatches: 20 })
      : 0,
    uploadingCount: includeReady
      ? await findCount(browser, { selector: GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR, maxMatches: 20 })
      : 0,
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
      value: { files: [] }, candidateCount: 0,
      observedSemantics: ["zero approved attachments", "zero visible attachment regions"], committedMutation: "no",
    });
  }
  const { expectedLabels, missing, unexpected } = attachmentSetDifference(files, observed.observedLabels);
  if (observed.observedLabels.length !== expectedLabels.length || missing.length > 0 || unexpected.length > 0) {
    throw executionFailure("failed", `GPT_ATTACHMENT_SET_MISMATCH:${[...missing, ...unexpected].join("|")}`);
  }
  return success({
    value: attachmentValue(files), candidateCount: observed.regionCount,
    observedSemantics: ["one exact attachment region", "all and only attempt-unique provider display names mounted"],
    committedMutation: "no",
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
  });
  while (true) {
    if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    last = await attachmentSetState(browser);
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
        value: attachmentValue(files), candidateCount: last.regionCount,
        observedSemantics: [
          "one exact attachment region",
          "all and only attempt-unique provider display names",
          "every exact attachment has visible provider file icon",
          "zero visible upload spinners",
        ],
        committedMutation: "no",
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
    const visibleChoiceCount = await findCount(browser, {
      selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
      textEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL,
      maxMatches: 2,
    });
    if (visibleChoiceCount === 1) return success({
      value: { state: "upload-choice-ready" }, candidateCount: 1,
      observedSemantics: ["one visible upload-from-computer choice"], committedMutation: "no",
    });
    if (visibleChoiceCount > 1) {
      throw executionFailure("failed", `GPT_UPLOAD_CHOICE_COUNT_${visibleChoiceCount}`);
    }
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_ATTACHMENT_CONTROL_OPEN_PENDING");
    await requireOneCandidate(browser, {
      selector: GPT_ATTACHMENT_CONTROL_SELECTOR,
      maxMatches: 2,
      waitFor: { minimumMatches: 1, timeoutMs: 5_000 },
    });
    await browser.executeDomIntent({
      kind: "click", selector: GPT_ATTACHMENT_CONTROL_SELECTOR, expectedMatches: 1,
      postClickMatch: {
        selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
        textEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL,
        expectedMatches: 1,
        timeoutMs: 5_000,
      },
    });
    return success({
      value: { state: "upload-choice-ready" }, candidateCount: 1,
      observedSemantics: ["one attachment control", "one visible upload-from-computer choice"], committedMutation: "confirmed",
    });
  },

  async attach_approved_gpt_files_once(intent, context) {
    requireExactInputKeys(intent, ["files"]);
    const files = filesFromIntent(intent);
    if (files.length === 0) return success({
      value: { files: [], mutationSent: false }, candidateCount: 0,
      observedSemantics: ["approved attachment set empty"], committedMutation: "no",
    });
    const browser = requireBrowser(context);
    if (context.mutationMode === "readback") return observeExactAttachmentSet(browser, files);
    await requireOneCandidate(browser, {
      selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
      textEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL,
      maxMatches: 2,
    });
    const grants = await issueGrants(browser, files);
    await browser.attachFile({ selector: GPT_FILE_INPUT_SELECTOR, grants });
    return success({
      value: {
        files: files.map(({ artifactRef, displayName, providerDisplayName, sha256, bytes }) => ({
          artifactRef, displayName, providerDisplayName, sha256, bytes,
        })),
        mutationSent: true,
      },
      candidateCount: 1,
      observedSemantics: ["one visible upload-from-computer choice", "one approved file-input batch", `${files.length} immutable grants`],
      committedMutation: "confirmed",
    });
  },

  async reconcile_gpt_attachment_set(intent, context) {
    requireExactInputKeys(intent, ["files", "timeoutMs"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    const timeoutMs = Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 60_000));
    return waitForUploadedAttachmentSet(browser, files, timeoutMs, context.signal);
  },
} satisfies GptChildHandlerMap;
