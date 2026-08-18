import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

interface DownloadEntry {
  filePath: string;
  mtimeMs: number;
  size: number;
}

interface LocatedImageDownload {
  status: "success" | "pending" | "review_required";
  message: string;
  point?: { x: number; y: number };
}

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

const imageExtensions = new Set([".png", ".webp", ".jpg", ".jpeg"]);
let generatedImageCaptureTail: Promise<void> = Promise.resolve();

async function withGeneratedImageCaptureLease<T>(work: () => Promise<T>): Promise<T> {
  const prior = generatedImageCaptureTail;
  let release!: () => void;
  generatedImageCaptureTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  try {
    return await work();
  } finally {
    release();
  }
}

async function downloads(): Promise<DownloadEntry[]> {
  const directory = path.join(os.homedir(), "Downloads");
  const entries = await readdir(directory, { withFileTypes: true });
  const output: DownloadEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const filePath = path.join(directory, entry.name);
    const metadata = await stat(filePath);
    output.push({ filePath, mtimeMs: metadata.mtimeMs, size: metadata.size });
  }
  return output;
}

function generatedImageTurnRole(turn: Element): string {
  return turn.getAttribute("data-turn") || "";
}

function generatedImageTurnHasSubstantiveContent(turn: Element): boolean {
  const hasText = Array.from(
    turn.querySelectorAll("[data-conversation-screenshot-content]"),
  ).some((node) => (node.textContent || "").trim().length > 0);
  const hasImage = Array.from(turn.querySelectorAll("img"))
    .some((image) => (image.currentSrc || image.getAttribute("src") || "").trim().length > 0);
  return hasText || hasImage;
}

export function decideGeneratedImageAssistantTurn(
  turns: readonly GeneratedImageTurnEvidence[],
): GeneratedImageTurnDecision {
  const promptIndexes = turns.flatMap((turn, index) =>
    turn.role === "user" && turn.promptMatched ? [index] : []);
  if (promptIndexes.length !== 1) {
    return { status: "review_required", message: "exact generated-image user prompt must occur once" };
  }
  const promptIndex = promptIndexes[0]!;
  const substantiveAfterPrompt = turns.flatMap((turn, index) =>
    index > promptIndex && turn.substantive ? [index] : []);
  if (substantiveAfterPrompt.length === 0) {
    return { status: "pending", message: "substantive assistant turn following exact prompt not found" };
  }
  const assistantIndex = substantiveAfterPrompt[0]!;
  if (turns[assistantIndex]!.role !== "assistant") {
    return { status: "review_required", message: "first substantive turn after generated-image prompt is not assistant" };
  }
  if (substantiveAfterPrompt.length > 1) {
    return { status: "review_required", message: "conversation advanced beyond generated-image assistant turn" };
  }
  return { status: "success", message: "exact generated-image assistant turn located", assistantIndex };
}

function findGeneratedImageAssistant(
  promptText: string,
): Element | LocatedImageDownload {
  const turns = Array.from(document.querySelectorAll(
    '[data-testid^="conversation-turn-"][data-turn="user"], [data-testid^="conversation-turn-"][data-turn="assistant"]',
  ));
  const decision = decideGeneratedImageAssistantTurn(turns.map((turn) => ({
    role: generatedImageTurnRole(turn) as "user" | "assistant",
    promptMatched: (turn.textContent || "").replace(/\s+/gu, " ").trim()
      === promptText.replace(/\s+/gu, " ").trim(),
    substantive: generatedImageTurnHasSubstantiveContent(turn),
  })));
  return decision.status === "success"
    ? turns[decision.assistantIndex!]!
    : decision;
}

function findGeneratedImageCard(
  assistant: Element,
): HTMLElement | LocatedImageDownload {
  const images = Array.from(assistant.querySelectorAll("img")).filter((image) => {
    const rect = image.getBoundingClientRect();
    const src = image.currentSrc || image.src || "";
    return rect.width >= 128 && rect.height >= 128
      && src && !src.startsWith("data:image/svg");
  });
  const logicalSources = new Set(images.map(
    (image) => (image.currentSrc || image.src).split("?")[0],
  ));
  if (logicalSources.size === 0) {
    return { status: "pending", message: "generated image not present in latest assistant turn" };
  }
  if (logicalSources.size > 1) {
    return { status: "review_required", message: "more than one logical image found in latest assistant turn" };
  }
  const cards = images.map((image) => image.closest('[role="button"]'))
    .filter((card): card is HTMLElement => card instanceof HTMLElement);
  const uniqueCards = [...new Set(cards)];
  if (uniqueCards.length !== 1) {
    return uniqueCards.length === 0
      ? { status: "pending", message: "generated image card is not interactive yet" }
      : { status: "review_required", message: "generated image assistant turn has ambiguous image cards" };
  }
  return uniqueCards[0]!;
}

function inspectGeneratedImageAssistantTurn(promptText: string): LocatedImageDownload {
  const assistant = findGeneratedImageAssistant(promptText);
  if (!(assistant instanceof Element)) return assistant;
  const target = findGeneratedImageCard(assistant);
  if (!(target instanceof HTMLElement)) return target;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { status: "pending", message: "generated image download control not visible" };
  }
  return {
    status: "success", message: "generated image card located",
    point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
  };
}

async function locateDownload(
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<LocatedImageDownload> {
  return browser.evaluate<LocatedImageDownload>({
    description: "locate generated image download inside exact latest assistant turn",
    script: `${generatedImageTurnRole.toString()}
${generatedImageTurnHasSubstantiveContent.toString()}
${decideGeneratedImageAssistantTurn.toString()}
${findGeneratedImageAssistant.toString()}
${findGeneratedImageCard.toString()}
return (${inspectGeneratedImageAssistantTurn.toString()})(${JSON.stringify(
  context.webChatExecution?.requestTextPrompt ?? "",
)});`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
}

function inspectGeneratedImageViewerDownload(): LocatedImageDownload {
  const candidates = Array.from(document.querySelectorAll('button[aria-label="保存"]'))
    .filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  if (candidates.length === 0) {
    return { status: "pending", message: "generated image viewer save action not present" };
  }
  if (candidates.length > 1) {
    return { status: "review_required", message: "generated image viewer has ambiguous save actions" };
  }
  const rect = candidates[0]!.getBoundingClientRect();
  return {
    status: "success",
    message: "generated image viewer save action located",
    point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
  };
}

async function locateViewerDownload(
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<LocatedImageDownload> {
  return browser.evaluate<LocatedImageDownload>({
    description: "locate unique generated image viewer save action",
    script: `return (${inspectGeneratedImageViewerDownload.toString()})();`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
}

async function waitForNewDownload(before: Set<string>, startedAt: number): Promise<DownloadEntry> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const candidates = (await downloads())
      .filter((entry) => !before.has(entry.filePath) && entry.mtimeMs >= startedAt - 1_000 && entry.size > 0)
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
    if (candidates.length > 1) {
      throw new Error("review_required: more than one new image download appeared during generated image capture");
    }
    const candidate = candidates[0];
    if (candidate) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const settled = await stat(candidate.filePath);
      if (settled.size === candidate.size && settled.size > 0) return candidate;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("review_required: generated image download did not complete");
}

async function downloadGeneratedImageOnce(input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<DownloadEntry> {
  const before = new Set((await downloads()).map((entry) => entry.filePath));
  const startedAt = Date.now();
  let located: LocatedImageDownload = { status: "pending", message: "not checked" };
  const deadline = Date.now() + Math.min(180_000, input.request.timeoutMs);
  while (Date.now() < deadline) {
    located = await locateDownload(input.browser, input.context);
    if (located.status === "review_required") throw new Error(`review_required: ${located.message}`);
    if (located.status === "success" && located.point) break;
    await input.browser.wait(1_000);
  }
  if (located.status !== "success" || !located.point) {
    throw new Error(`review_required: ${located.message}`);
  }
  const opened = await input.browser.click({
    targetLabel: "generated image card in exact assistant turn",
    point: located.point,
    coordinateSpace: "browserViewport",
  });
  if (!opened.ok) throw new Error("review_required: generated image card click failed");
  let viewerDownload: LocatedImageDownload = { status: "pending", message: "not checked" };
  const viewerDeadline = Date.now() + 30_000;
  while (Date.now() < viewerDeadline) {
    viewerDownload = await locateViewerDownload(input.browser, input.context);
    if (viewerDownload.status === "review_required") {
      throw new Error(`review_required: ${viewerDownload.message}`);
    }
    if (viewerDownload.status === "success" && viewerDownload.point) break;
    await input.browser.wait(500);
  }
  if (viewerDownload.status !== "success" || !viewerDownload.point) {
    throw new Error(`review_required: ${viewerDownload.message}`);
  }
  const clicked = await input.browser.click({
    targetLabel: "unique download action in generated image viewer",
    point: viewerDownload.point,
    coordinateSpace: "browserViewport",
  });
  if (!clicked.ok) throw new Error("review_required: generated image viewer download click failed");
  return waitForNewDownload(before, startedAt);
}

async function persistGeneratedImageArtifact(
  input: {
    request: AiFeedInput;
    context: AiProviderAdapterContext;
  },
  downloaded: DownloadEntry,
): Promise<GeneratedImageArtifact> {
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(downloaded.filePath).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error("review_required: generated image could not be decoded");
  }
  const executionId = input.context.webChatExecution?.executionId ?? input.request.taskIdentity.sourceTaskId;
  const directory = path.join(input.context.dataDir, "runtime-data", "ai-input-gateway", "generated-images");
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${executionId}${path.extname(downloaded.filePath).toLowerCase()}`);
  await copyFile(downloaded.filePath, filePath);
  const file = await import("node:fs/promises").then((fs) => fs.readFile(filePath));
  const imageHash = `sha256:${createHash("sha256").update(file).digest("hex")}` as const;
  const providerOutputRef = `artifact://ai-input-gateway/${executionId}/generated-image`;
  return {
    kind: "generated_image",
    artifactRef: providerOutputRef,
    providerOutputRef,
    filePath,
    mimeType: metadata.format === "png" ? "image/png" : metadata.format === "webp" ? "image/webp" : "image/jpeg",
    sha256: imageHash,
    originalSha256: imageHash,
    byteCount: file.byteLength,
    width: metadata.width,
    height: metadata.height,
  };
}

async function captureChatGptGeneratedImageOnce(input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<GeneratedImageArtifact | null> {
  if (input.request.expectedOutputKind !== "generated_image") return null;
  const downloaded = await downloadGeneratedImageOnce(input);
  return persistGeneratedImageArtifact(input, downloaded);
}

export async function captureChatGptGeneratedImage(input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<GeneratedImageArtifact | null> {
  if (input.request.expectedOutputKind !== "generated_image") return null;
  return withGeneratedImageCaptureLease(() => captureChatGptGeneratedImageOnce(input));
}
