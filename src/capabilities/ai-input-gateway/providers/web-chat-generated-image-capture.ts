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
  return turn.getAttribute("data-message-author-role")
    || turn.querySelector("[data-message-author-role]")
      ?.getAttribute("data-message-author-role")
    || "";
}

function findGeneratedImageAssistant(
  marker: string,
): Element | LocatedImageDownload {
  const turns = Array.from(document.querySelectorAll(
    'article[data-testid^="conversation-turn"], [data-message-author-role="assistant"]',
  ));
  const markedUserTurns = marker
    ? turns.filter((turn) => generatedImageTurnRole(turn) === "user"
      && (turn.textContent || "").includes(marker))
    : [];
  if (markedUserTurns.length !== 1) {
    return { status: "review_required", message: "exact generated-image user turn marker must occur once" };
  }
  const markerIndex = turns.indexOf(markedUserTurns[0]!);
  const assistantIndex = turns.findIndex(
    (turn, index) => index > markerIndex
      && generatedImageTurnRole(turn) === "assistant",
  );
  if (assistantIndex < 0) {
    return { status: "pending", message: "assistant turn following exact marker not found" };
  }
  if (turns.slice(assistantIndex + 1).some(
    (turn) => generatedImageTurnRole(turn) === "user"
      || generatedImageTurnRole(turn) === "assistant",
  )) {
    return { status: "review_required", message: "conversation advanced beyond generated-image assistant turn" };
  }
  return turns[assistantIndex]!;
}

function findGeneratedImageDownloadButton(
  assistant: Element,
): HTMLButtonElement | LocatedImageDownload {
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
  const downloadButtons = Array.from(assistant.querySelectorAll("button"))
    .filter((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`
        .toLowerCase();
      return label.includes("download") || label.includes("下载");
    });
  if (downloadButtons.length > 1) {
    return { status: "review_required", message: "generated image assistant turn has ambiguous download controls" };
  }
  const target = downloadButtons[0];
  if (!target) {
    return { status: "pending", message: "generated image download control not present" };
  }
  return target;
}

function inspectGeneratedImageAssistantTurn(marker: string): LocatedImageDownload {
  const assistant = findGeneratedImageAssistant(marker);
  if (!(assistant instanceof Element)) return assistant;
  const target = findGeneratedImageDownloadButton(assistant);
  if (!(target instanceof HTMLButtonElement)) return target;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { status: "pending", message: "generated image download control not visible" };
  }
  return {
    status: "success", message: "generated image download located",
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
${findGeneratedImageAssistant.toString()}
${findGeneratedImageDownloadButton.toString()}
(${inspectGeneratedImageAssistantTurn.toString()})(${JSON.stringify(
  context.webChatExecution?.turnMarker ?? "",
)})`,
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

async function captureChatGptGeneratedImageOnce(input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<NonNullable<import("../contracts/ai-provider-adapter.contract.js").AiProviderRawResponse["outputArtifacts"]>[number] | null> {
  if (input.request.expectedOutputKind !== "generated_image") return null;
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
  const clicked = await input.browser.click({
    targetLabel: "generated image download in latest assistant turn",
    point: located.point,
    coordinateSpace: "browserViewport",
  });
  if (!clicked.ok) throw new Error("review_required: generated image download click failed");
  const downloaded = await waitForNewDownload(before, startedAt);
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

export async function captureChatGptGeneratedImage(input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<NonNullable<import("../contracts/ai-provider-adapter.contract.js").AiProviderRawResponse["outputArtifacts"]>[number] | null> {
  if (input.request.expectedOutputKind !== "generated_image") return null;
  return withGeneratedImageCaptureLease(() => captureChatGptGeneratedImageOnce(input));
}
