import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { UploadableAiFeedInputRef } from "../runtime/ai-feed-input-package.js";
import {
  clickDesktopPoint,
  copyFileObjectToMacClipboard,
  pasteMacClipboardIntoChrome,
  pressEscapeInChrome,
} from "./web-chat-clipboard.js";
import {
  assertUploadTarget,
  clearComposer,
  findUploadMenuPoint,
  focusComposer,
  waitForUploadComplete,
  waitForUploadTarget,
} from "./web-chat-page-actions.js";

const uploadFileViaClipboardPaste = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  filePath: string,
): Promise<void> => {
  const focused = await focusComposer(browser, context);
  if (focused.status !== "success") {
    throw new Error(`${focused.status}: ${focused.message}`);
  }
  await copyFileObjectToMacClipboard(filePath, context.abortSignal);
  await pasteMacClipboardIntoChrome(context.abortSignal);
};

const getDesktopPoint = (point: { x?: number; y?: number; status: string; message: string }) => {
  if (typeof point.x !== "number" || typeof point.y !== "number") {
    throw new Error(`${point.status}: ${point.message}`);
  }
  return { x: point.x, y: point.y };
};

const clickUploadMenuPoint = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<"composer-plus" | "upload-menu-item"> => {
  const firstPoint = await findUploadMenuPoint(browser, context);
  await clickDesktopPoint(getDesktopPoint(firstPoint), context.abortSignal);
  await browser.wait(firstPoint.target === "composer-plus" ? 900 : 1_000);
  return firstPoint.target ?? "upload-menu-item";
};

const clickUploadMenuItemAfterPlus = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<void> => {
  const menuPoint = await findUploadMenuPoint(browser, context);
  if (menuPoint.status !== "success" || menuPoint.target !== "upload-menu-item") {
    throw new Error(`${menuPoint.status}: ${menuPoint.message}`);
  }
  await clickDesktopPoint(getDesktopPoint(menuPoint), context.abortSignal);
  await browser.wait(1_000);
};

const uploadFileViaProviderMenu = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<void> => {
  await pressEscapeInChrome(context.abortSignal).catch(() => undefined);
  await browser.wait(300);
  const target = await clickUploadMenuPoint(browser, context);
  if (target === "composer-plus") await clickUploadMenuItemAfterPlus(browser, context);
};

const listUploadableRefs = (request: AiFeedInput): UploadableAiFeedInputRef[] =>
  request.inputRefs.flatMap((ref) => (
    ref.filePath
      ? [{
          id: ref.id,
          filePath: ref.filePath,
          mimeType: ref.mimeType ?? null,
          summary: ref.summary,
        }]
      : []
  ));

const waitForRefUploadComplete = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
}): Promise<void> => {
  await waitForUploadComplete(input.browser, input.context, input.ref.filePath, input.request.timeoutMs);
};

const uploadLocatedFileInput = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
}): Promise<void> => {
  const selector = assertUploadTarget(await waitForUploadTarget(input.browser, input.context, input.request.timeoutMs));
  const uploaded = await input.browser.setFileInputFiles({
    elementRef: { selector, targetKind: "file-input" },
    filePath: input.ref.filePath,
    description: `upload governed input file ${input.ref.id} to provider web chat`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!uploaded.ok) {
    throw new Error(`failed: ${uploaded.message}`);
  }
  await waitForRefUploadComplete(input);
};

const tryClipboardUpload = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
}): Promise<void> => {
  await uploadFileViaClipboardPaste(input.browser, input.context, input.ref.filePath);
  await waitForRefUploadComplete(input);
};

const uploadSingleFile = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
}): Promise<void> => {
  try {
    await tryClipboardUpload(input);
    return;
  } catch {
    try {
      await uploadLocatedFileInput(input);
      return;
    } catch {
      await uploadFileViaProviderMenu(input.browser, input.context);
      await uploadLocatedFileInput(input);
    }
  }
};

export const uploadFiles = async (
  browser: BrowserController,
  request: AiFeedInput,
  context: AiProviderAdapterContext,
): Promise<void> => {
  const refs = listUploadableRefs(request);
  if (refs.length > 0) {
    await clearComposer(browser, context);
    await browser.wait(800);
  }
  for (const ref of refs) {
    await uploadSingleFile({ browser, context, request, ref });
  }
};
