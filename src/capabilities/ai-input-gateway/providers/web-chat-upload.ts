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
} from "./web-chat-page-actions.js";
import {
  clearComposer,
} from "./web-chat-upload-page-actions.js";

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

const uploadSingleFileByClipboardPaste = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  ref: UploadableAiFeedInputRef;
  expectedAttachmentCount: number;
}): Promise<void> => {
  await uploadFileViaClipboardPaste(input.browser, input.context, input.ref.filePath, input.expectedAttachmentCount);
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
    await uploadSingleFileByClipboardPaste({ browser, context, ref, expectedAttachmentCount: index + 1 });
  }
};
