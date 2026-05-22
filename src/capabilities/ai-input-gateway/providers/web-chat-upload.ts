import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { UploadableAiFeedInputRef } from "../runtime/ai-feed-input-package.js";
import {
  copyFileObjectToMacClipboard,
  pasteMacClipboardIntoChrome,
} from "./web-chat-clipboard.js";
import {
  focusComposer,
  waitForAttachmentCountAtLeast,
  waitForComposerFocused,
  waitForUploadComplete,
} from "./web-chat-page-actions.js";
import {
  assertUploadTarget,
  clearComposer,
  waitForUploadTarget,
} from "./web-chat-upload-page-actions.js";
import { openProviderUploadMenu } from "./web-chat-upload-menu.js";

const FILE_SELECTION_TIMEOUT_MS = 20_000;
const CLIPBOARD_UPLOAD_TIMEOUT_MS = 20_000;
const CLIPBOARD_PASTE_RETRY_LIMIT = 3;

const withUploadTimeout = async <T>(
  label: string,
  timeoutMs: number,
  action: Promise<T>,
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`review_required: ${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([action, timeoutPromise]);
};

const uploadFileViaClipboardPaste = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  filePath: string,
  expectedAttachmentCount: number,
): Promise<void> => {
  const focused = await focusComposer(browser, context);
  if (focused.status !== "success") {
    throw new Error(`${focused.status}: ${focused.message}`);
  }
  await waitForComposerFocused(browser, context, 2_000);
  for (let attempt = 1; attempt <= CLIPBOARD_PASTE_RETRY_LIMIT; attempt += 1) {
    await withUploadTimeout(
      "provider clipboard file paste",
      CLIPBOARD_UPLOAD_TIMEOUT_MS,
      copyFileObjectToMacClipboard(filePath, context.abortSignal)
        .then(() => focusComposer(browser, context))
        .then(() => waitForComposerFocused(browser, context, 2_000))
        .then(() => pasteMacClipboardIntoChrome(context.abortSignal)),
    );
    await browser.wait(1_500);
    try {
      await waitForAttachmentCountAtLeast(browser, context, expectedAttachmentCount, 8_000);
      return;
    } catch (error) {
      if (attempt >= CLIPBOARD_PASTE_RETRY_LIMIT) throw error;
      await browser.wait(300);
    }
  }
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
  expectedAttachmentCount: number;
}): Promise<void> => {
  try {
    await waitForAttachmentCountAtLeast(input.browser, input.context, input.expectedAttachmentCount, input.request.timeoutMs);
    return;
  } catch {
    await waitForUploadComplete(input.browser, input.context, input.ref.filePath, input.request.timeoutMs);
  }
};

const setProviderFileInputWithTimeout = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  ref: UploadableAiFeedInputRef;
  selector: string;
}) => {
  const uploadPromise = input.browser.setFileInputFiles({
    elementRef: { selector: input.selector, targetKind: "file-input" },
    filePath: input.ref.filePath,
    description: `upload governed input file ${input.ref.id} to provider web chat`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  const timeoutPromise = new Promise<Awaited<typeof uploadPromise>>((resolve) => {
    setTimeout(() => resolve({
      browserActionId: "browser_file_input_timeout",
      ok: false,
      message: "provider file input selection timed out",
      createdAt: new Date().toISOString(),
    }), FILE_SELECTION_TIMEOUT_MS);
  });
  return Promise.race([uploadPromise, timeoutPromise]);
};

const uploadLocatedFileInput = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
  expectedAttachmentCount: number;
}): Promise<void> => {
  const selector = assertUploadTarget(await waitForUploadTarget(input.browser, input.context, input.request.timeoutMs));
  const uploaded = await setProviderFileInputWithTimeout({ ...input, selector });
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
  expectedAttachmentCount: number;
}): Promise<void> => {
  await uploadFileViaClipboardPaste(input.browser, input.context, input.ref.filePath, input.expectedAttachmentCount);
  await waitForRefUploadComplete(input);
};

const uploadSingleFile = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
  expectedAttachmentCount: number;
}): Promise<void> => {
  try {
    await uploadLocatedFileInput(input);
    return;
  } catch {
    try {
      await openProviderUploadMenu(input.browser, input.context);
      await uploadLocatedFileInput(input);
      return;
    } catch {
      await tryClipboardUpload(input);
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
  for (const [index, ref] of refs.entries()) {
    await uploadSingleFile({ browser, context, request, ref, expectedAttachmentCount: index + 1 });
  }
};
