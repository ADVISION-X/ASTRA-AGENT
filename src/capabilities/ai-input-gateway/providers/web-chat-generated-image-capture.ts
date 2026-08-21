import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

export interface GeneratedImageTurnEvidence {
  role: "user" | "assistant";
  promptMatched: boolean;
  substantive: boolean;
}

export interface GeneratedImageTurnDecision {
  status: "success" | "pending" | "review_required";
  message: string;
  assistantIndex?: number;
}

type GeneratedImageArtifact = NonNullable<
  import("../contracts/ai-provider-adapter.contract.js").AiProviderRawResponse["outputArtifacts"]
>[number];

type DomRecord = Record<string, unknown>;
type GeneratedImageBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait">;
type GeneratedImageCard = Readonly<{
  selector: string;
  elementKind: "HTMLElement";
  role: "button";
  visible: boolean;
}>;
type DownloadFile = Readonly<{ filePath: string; mtimeMs: number; size: number }>;

const GENERATED_IMAGE_TURN_ATTRIBUTE = "data-turn";
const GENERATED_IMAGE_SAVE_BUTTON_SELECTOR = 'button[aria-label="保存"]';
const USER_TURN_SELECTOR = `[data-testid^='conversation-turn-'][${GENERATED_IMAGE_TURN_ATTRIBUTE}='user']`;
const GENERATED_IMAGE_ALT_PREFIX = "已生成图片：";
const GENERATED_IMAGE_CARD_ELEMENT_KIND = "HTMLElement" as const;
const GENERATED_IMAGE_DIALOG_SELECTOR = 'div[role="dialog"]';
const GENERATED_IMAGE_SAVE_SELECTOR = `${GENERATED_IMAGE_DIALOG_SELECTOR} ${GENERATED_IMAGE_SAVE_BUTTON_SELECTOR}`;
const GENERATED_IMAGE_VIEWER_CLOSE_SELECTOR = 'div[role="dialog"] button[aria-label="关闭全屏显示"]';
const DOWNLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_POLL_MS = 500;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

const asRecord = (value: unknown): DomRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as DomRecord;
};

const count = async (browser: GeneratedImageBrowser, selector: string, maxMatches: number, textContains?: string): Promise<number> => {
  const result = asRecord(await browser.executeDomIntent({
    kind: "find",
    selector,
    maxMatches,
    ...(textContains === undefined ? {} : { textContains }),
  }));
  if (typeof result.count !== "number" || !Number.isInteger(result.count) || result.count < 0) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return result.count;
};

const readAttribute = async (browser: GeneratedImageBrowser, input: {
  selector: string;
  name: string;
  textContains?: string;
}): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readAttribute",
    selector: input.selector,
    name: input.name,
    expectedMatches: 1,
    maxChars: 8_192,
    ...(input.textContains === undefined ? {} : { textContains: input.textContains }),
  });
  if (typeof value !== "string" || value.length === 0) throw new Error("BROWSER_TARGET_INVALID");
  return value;
};

const inspect = async (browser: GeneratedImageBrowser, selector: string): Promise<DomRecord> =>
  asRecord(await browser.executeDomIntent({
    kind: "inspect",
    selector,
    fields: ["tagName", "role", "visible", "disabled"],
  }));

const turnOrdinal = (testId: string): number => {
  const match = /^conversation-turn-([1-9][0-9]*)$/u.exec(testId);
  if (!match) throw new Error("BROWSER_TARGET_INVALID");
  const ordinal = Number(match[1]);
  if (!Number.isSafeInteger(ordinal)) throw new Error("BROWSER_TARGET_INVALID");
  return ordinal;
};

const findGeneratedImageAssistantTurn = async (
  browser: GeneratedImageBrowser,
  marker: string,
): Promise<string> => {
  const markedCount = await count(browser, USER_TURN_SELECTOR, 2, marker);
  if (markedCount !== 1) {
    throw new Error("review_required: exact marked generated-image user turn is absent or ambiguous");
  }
  const userTurnId = await readAttribute(browser, {
    selector: USER_TURN_SELECTOR,
    name: "data-testid",
    textContains: marker,
  });
  const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
  const assistantSelector = `[data-testid=${JSON.stringify(assistantTurnId)}][${GENERATED_IMAGE_TURN_ATTRIBUTE}='assistant']`;
  if (await count(browser, assistantSelector, 2) !== 1) {
    throw new Error("review_required: exact assistant turn immediately following the marked user turn is absent or ambiguous");
  }
  return assistantSelector;
};

const findGeneratedImageCard = async (
  browser: GeneratedImageBrowser,
  assistantSelector: string,
): Promise<GeneratedImageCard> => {
  const imageSelector = `${assistantSelector} img[alt^=${JSON.stringify(GENERATED_IMAGE_ALT_PREFIX)}]`;
  if (await count(browser, imageSelector, 2) !== 1) {
    throw new Error("review_required: exact generated-image card is absent or ambiguous");
  }
  const selector = `${assistantSelector} div[role="button"]:has(img[alt^=${JSON.stringify(GENERATED_IMAGE_ALT_PREFIX)}])`;
  if (await count(browser, selector, 2) !== 1) {
    throw new Error("review_required: exact generated-image HTMLElement role=button card is absent or ambiguous");
  }
  const card = await inspect(browser, selector);
  if (card.tagName !== "DIV" || card.role !== "button" || card.visible !== true) {
    throw new Error("review_required: exact generated-image HTMLElement role=button card is not visible");
  }
  return {
    selector,
    elementKind: GENERATED_IMAGE_CARD_ELEMENT_KIND,
    role: "button",
    visible: true,
  };
};

export const generatedImageTurnHasSubstantiveContent = (input: {
  elementKind: string;
  role: string;
  visible: boolean;
  alt: string;
  sourceUrl: string;
}): boolean => input.elementKind === "HTMLElement"
  && input.role === "button"
  && input.visible
  && input.alt.startsWith(GENERATED_IMAGE_ALT_PREFIX)
  && input.sourceUrl.startsWith("https://chatgpt.com/backend-api/estuary/content?id=");

const findGeneratedImageSource = async (browser: GeneratedImageBrowser, card: GeneratedImageCard): Promise<{ alt: string; sourceUrl: string }> => {
  const imageSelector = `${card.selector} img[alt^=${JSON.stringify(GENERATED_IMAGE_ALT_PREFIX)}]`;
  return {
    alt: await readAttribute(browser, { selector: imageSelector, name: "alt" }),
    sourceUrl: await readAttribute(browser, { selector: imageSelector, name: "src" }),
  };
};

const findSaveButton = async (browser: GeneratedImageBrowser): Promise<string> => {
  if (await count(browser, GENERATED_IMAGE_DIALOG_SELECTOR, 2) !== 1
    || await count(browser, GENERATED_IMAGE_SAVE_SELECTOR, 2) !== 1) {
    throw new Error("review_required: exact generated-image viewer or button[aria-label=保存] is absent or ambiguous");
  }
  const save = await inspect(browser, GENERATED_IMAGE_SAVE_SELECTOR);
  if (save.tagName !== "BUTTON" || save.visible !== true || save.disabled === true) {
    throw new Error("review_required: exact generated-image button[aria-label=保存] is not actionable");
  }
  return GENERATED_IMAGE_SAVE_SELECTOR;
};

const closeGeneratedImageViewer = async (browser: GeneratedImageBrowser): Promise<void> => {
  if (await count(browser, GENERATED_IMAGE_DIALOG_SELECTOR, 2) === 0) return;
  if (await count(browser, GENERATED_IMAGE_VIEWER_CLOSE_SELECTOR, 2) !== 1) {
    throw new Error("review_required: generated-image viewer close control is absent or ambiguous");
  }
  await browser.executeDomIntent({ kind: "click", selector: GENERATED_IMAGE_VIEWER_CLOSE_SELECTOR, expectedMatches: 1 });
  await browser.wait({ durationMs: 250 });
  if (await count(browser, GENERATED_IMAGE_DIALOG_SELECTOR, 2) !== 0) {
    throw new Error("review_required: generated-image viewer did not close");
  }
};

const listDownloadFiles = async (): Promise<DownloadFile[]> => {
  const directory = path.join(os.homedir(), "Downloads");
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const files = await Promise.all(names
    .filter((name) => !name.endsWith(".crdownload") && !name.endsWith(".download") && !name.endsWith(".tmp"))
    .map(async (name): Promise<DownloadFile | null> => {
      const filePath = path.join(directory, name);
      try {
        const details = await stat(filePath);
        return details.isFile() ? { filePath, mtimeMs: details.mtimeMs, size: details.size } : null;
      } catch {
        return null;
      }
    }));
  return files.filter((file): file is DownloadFile => file !== null);
};

const waitForNewDownload = async (
  browser: GeneratedImageBrowser,
  baselineFiles: readonly DownloadFile[],
  signal?: AbortSignal,
): Promise<string> => {
  const baseline = new Map(baselineFiles.map((file) => [file.filePath, `${file.mtimeMs}:${file.size}`]));
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("BROWSER_TARGET_INVALID");
    const current = (await listDownloadFiles())
      .filter((file) => file.size > 0)
      .filter((file) => baseline.get(file.filePath) !== `${file.mtimeMs}:${file.size}`);
    if (current.length > 1) throw new Error("review_required: more than one new image download appeared during generated image capture");
    if (current.length === 1) return current[0]!.filePath;
    await browser.wait({ durationMs: DOWNLOAD_POLL_MS });
  }
  throw new Error("review_required: generated-image download did not materialize within the bounded window");
};

const hashBytes = (bytes: Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const persistDownloadedImage = async (input: {
  downloadedPath: string;
  sourceUrl: string;
  dataDir: string;
}): Promise<GeneratedImageArtifact> => {
  const bytes = await readFile(input.downloadedPath);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("review_required: generated-image download size is outside the bounded image contract");
  }
  let metadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    throw new Error("review_required: generated-image download is not decodable");
  }
  const mimeType = metadata.format === "jpeg" ? "image/jpeg" : metadata.format ? `image/${metadata.format}` : null;
  if (!mimeType || !metadata.width || !metadata.height) {
    throw new Error("review_required: generated-image download has no verified image format or dimensions");
  }
  const directory = path.join(input.dataDir, "runtime-data", "ai-input-gateway", "generated-images");
  await mkdir(directory, { recursive: true });
  const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
  const filePath = path.join(directory, `${randomUUID()}.${extension}`);
  await copyFile(input.downloadedPath, filePath);
  const originalSha256 = hashBytes(bytes);
  const logicalSources = [input.sourceUrl];
  if (logicalSources.length !== 1) throw new Error("review_required: generated-image logical source identity is ambiguous");
  return {
    kind: "generated_image",
    artifactRef: `generated-image:${randomUUID()}`,
    filePath,
    mimeType,
    sha256: originalSha256,
    originalSha256,
    providerOutputRef: `chatgpt-generated-image:${hashBytes(Buffer.from(logicalSources[0]!, "utf8"))}`,
    byteCount: bytes.byteLength,
    width: metadata.width,
    height: metadata.height,
  };
};

export function decideGeneratedImageAssistantTurn(
  turns: readonly GeneratedImageTurnEvidence[],
): GeneratedImageTurnDecision {
  const promptIndexes = turns.flatMap((turn, index) =>
    turn.role === "user" && turn.promptMatched ? [index] : []);
  if (promptIndexes.length !== 1) {
    return { status: "review_required", message: "exact generated-image user prompt must occur once" };
  }
  const assistantIndexes = turns.flatMap((turn, index) =>
    index > promptIndexes[0]! && turn.role === "assistant" && turn.substantive ? [index] : []);
  if (assistantIndexes.length === 0) {
    return { status: "pending", message: "substantive assistant turn following exact prompt not found" };
  }
  if (assistantIndexes.length !== 1) {
    return { status: "review_required", message: "conversation advanced beyond generated-image assistant turn" };
  }
  return { status: "success", message: "exact generated-image assistant turn located", assistantIndex: assistantIndexes[0]! };
}

const downloadGeneratedImage = async (input: {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  sourceUrl: string;
}): Promise<GeneratedImageArtifact> => {
  const saveSelector = await findSaveButton(input.browser);
  const baselineFiles = await listDownloadFiles();
  await input.browser.executeDomIntent({ kind: "click", selector: saveSelector, expectedMatches: 1 });
  const downloadedPath = await waitForNewDownload(input.browser, baselineFiles, input.context.abortSignal);
  return persistDownloadedImage({
    downloadedPath,
    sourceUrl: input.sourceUrl,
    dataDir: input.context.dataDir,
  });
};

export async function captureChatGptGeneratedImage(input: {
  browser: BrowserTargetLease;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<GeneratedImageArtifact | null> {
  if (input.request.expectedOutputKind !== "generated_image") return null;
  const marker = input.context.webChatExecution?.turnMarker;
  if (!marker) throw new Error("review_required: generated-image execution has no immutable turn marker");
  const assistantSelector = await findGeneratedImageAssistantTurn(input.browser, marker);
  const card = await findGeneratedImageCard(input.browser, assistantSelector);
  const image = await findGeneratedImageSource(input.browser, card);
  if (!generatedImageTurnHasSubstantiveContent({
    elementKind: card.elementKind,
    role: card.role,
    visible: card.visible,
    alt: image.alt,
    sourceUrl: image.sourceUrl,
  })) {
    throw new Error("review_required: exact generated-image assistant turn has no substantive image content");
  }
  await input.browser.executeDomIntent({ kind: "click", selector: card.selector, expectedMatches: 1 });
  await input.browser.wait({ durationMs: 350 });
  try {
    return await downloadGeneratedImage({
      browser: input.browser,
      context: input.context,
      sourceUrl: image.sourceUrl,
    });
  } finally {
    await closeGeneratedImageViewer(input.browser);
  }
}
