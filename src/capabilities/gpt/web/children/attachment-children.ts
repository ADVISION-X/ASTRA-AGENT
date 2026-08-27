import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { BrowserFileArtifactGrantV1 } from "../../../../lib/browser/browser-authority-api.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import type { GptChildHandlerMap } from "../child-handler.js";
import {
  arrayInput,
  requireBrowser,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import { findCount, readExactText, requireOneCandidate } from "../gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_ATTACHMENT_REGION_SELECTOR,
  GPT_FILE_INPUT_SELECTOR,
} from "../contracts/attachment.contract.js";

type ApprovedFile = Readonly<{
  artifactRef: string;
  filePath: string;
  displayName: string;
  sha256: `sha256:${string}`;
  bytes: number;
}>;

const digest = (bytes: Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const filesFromIntent = (intent: GptChildCapabilityIntent): readonly ApprovedFile[] => {
  const files = arrayInput(intent, "files").map((value): ApprovedFile => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("failed:GPT_ATTACHMENT_INPUT_INVALID");
    }
    const item = value as Record<string, unknown>;
    if (typeof item.artifactRef !== "string" || item.artifactRef.length === 0
      || typeof item.filePath !== "string" || item.filePath.length === 0
      || typeof item.displayName !== "string" || item.displayName.length === 0
      || typeof item.sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.sha256)
      || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw new Error("failed:GPT_ATTACHMENT_INPUT_INVALID");
    }
    return {
      artifactRef: item.artifactRef,
      filePath: item.filePath,
      displayName: item.displayName.normalize("NFC"),
      sha256: item.sha256 as `sha256:${string}`,
      bytes: item.bytes,
    };
  });
  const names = files.map((file) => file.displayName);
  if (new Set(names).size !== names.length) throw new Error("review_required:GPT_ATTACHMENT_DISPLAY_NAME_DUPLICATE");
  return files;
};

const verifyFiles = async (files: readonly ApprovedFile[]): Promise<void> => {
  for (const file of files) {
    const bytes = await readFile(file.filePath);
    if (bytes.byteLength !== file.bytes || digest(bytes) !== file.sha256) {
      throw new Error(`review_required:GPT_ATTACHMENT_SOURCE_CHANGED:${file.artifactRef}`);
    }
  }
};

const issueGrants = async (
  browser: ReturnType<typeof requireBrowser>,
  files: readonly ApprovedFile[],
): Promise<readonly BrowserFileArtifactGrantV1[]> => {
  await verifyFiles(files);
  const grants: BrowserFileArtifactGrantV1[] = [];
  for (const file of files) {
    await browser.registerFileArtifact({
      artifactRef: file.artifactRef,
      filePath: file.filePath,
      contentHash: file.sha256,
      sizeBytes: file.bytes,
    });
    grants.push(await browser.issueFileArtifactGrant({
      artifactRef: file.artifactRef,
      expectedSha256: file.sha256,
      maxBytes: file.bytes,
    }));
  }
  return grants;
};

const countOccurrences = (value: string, needle: string): number =>
  needle.length === 0 ? 0 : value.split(needle).length - 1;

export const attachmentChildHandlers = {
  async open_gpt_attachment_control(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const inputCount = await findCount(browser, { selector: GPT_FILE_INPUT_SELECTOR, maxMatches: 2 });
    if (inputCount === 1) return success({
      value: { state: "file-input-ready" }, candidateCount: 1,
      observedSemantics: ["one exact GPT file input"], committedMutation: "no",
    });
    if (inputCount > 1) throw new Error(`review_required:GPT_FILE_INPUT_COUNT_${inputCount}`);
    await requireOneCandidate(browser, { selector: GPT_ATTACHMENT_CONTROL_SELECTOR, maxMatches: 2 });
    await browser.executeDomIntent({
      kind: "click", selector: GPT_ATTACHMENT_CONTROL_SELECTOR, expectedMatches: 1,
    });
    const after = await findCount(browser, { selector: GPT_FILE_INPUT_SELECTOR, maxMatches: 2 });
    if (after !== 1) throw new Error("review_required:GPT_FILE_INPUT_OPEN_UNCONFIRMED");
    return success({
      value: { state: "file-input-ready" }, candidateCount: 1,
      observedSemantics: ["one attachment control", "one exact file input"], committedMutation: "yes",
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
    await requireOneCandidate(browser, { selector: GPT_FILE_INPUT_SELECTOR, maxMatches: 2 });
    const grants = await issueGrants(browser, files);
    await browser.attachFile({ selector: GPT_FILE_INPUT_SELECTOR, grants });
    return success({
      value: {
        files: files.map(({ artifactRef, displayName, sha256, bytes }) => ({ artifactRef, displayName, sha256, bytes })),
        mutationSent: true,
      },
      candidateCount: 1,
      observedSemantics: ["one exact file input", "one approved batch", `${files.length} immutable grants`],
      committedMutation: "yes",
    });
  },

  async verify_gpt_attachment_set(intent, context) {
    requireExactInputKeys(intent, ["files"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    const regionCount = await findCount(browser, { selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2 });
    if (files.length === 0) {
      if (regionCount !== 0) throw new Error(`review_required:GPT_ATTACHMENT_REGION_COUNT_${regionCount}`);
      return success({
        value: { files: [] }, candidateCount: 0,
        observedSemantics: ["zero approved attachments", "zero visible attachment regions"], committedMutation: "no",
      });
    }
    if (regionCount !== 1) throw new Error(`review_required:GPT_ATTACHMENT_REGION_COUNT_${regionCount}`);
    const text = await readExactText(browser, GPT_ATTACHMENT_REGION_SELECTOR, 16_384);
    const mismatches = files.filter((file) => countOccurrences(text, file.displayName) !== 1);
    const unexplained = files.reduce(
      (remaining, file) => remaining.split(file.displayName).join(""),
      text,
    ).replace(/\s+/gu, "");
    if (mismatches.length || unexplained.length > 0) {
      throw new Error(`review_required:GPT_ATTACHMENT_SET_MISMATCH:${mismatches.map((file) => file.displayName).join("|")}`);
    }
    return success({
      value: { files: files.map(({ artifactRef, displayName, sha256, bytes }) => ({ artifactRef, displayName, sha256, bytes })) },
      candidateCount: regionCount,
      observedSemantics: ["one exact attachment region", "all and only approved display names"],
      committedMutation: "no",
    });
  },
} satisfies GptChildHandlerMap;
