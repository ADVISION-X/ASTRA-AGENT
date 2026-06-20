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
const COMPOSER_FOCUS_RETRY_TIMEOUT_MS = 15_000;

const terminalUploadStageLog = (line: string): void => {
  process.stdout.write(`[GRASSEYE][AI-GATEWAY][WEB-CHAT] ${line}\n`);
};

const formatUploadStageRefs = (refs: Record<string, string | number | boolean | null | undefined>): string =>
  Object.entries(refs)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

const emitUploadStage = (input: {
  request: AiFeedInput;
  stage: string;
  status: "start" | "success" | "failed";
  startedAtMs: number | null;
  refs?: Record<string, string | number | boolean | null | undefined>;
}): void => {
  terminalUploadStageLog(formatUploadStageRefs({
    stage: input.stage,
    status: input.status,
    providerKind: input.request.providerKind,
    promptPackageId: input.request.promptPackageId,
    promptContractId: input.request.promptContractId,
    elapsedMs: input.startedAtMs === null ? undefined : Date.now() - input.startedAtMs,
    ...(input.refs ?? {}),
  }));
};

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
  const focusDeadline = Date.now() + COMPOSER_FOCUS_RETRY_TIMEOUT_MS;
  let lastFocusMessage = "provider input box was not checked";
  while (Date.now() < focusDeadline) {
    try {
      const focused = await focusComposer(browser, context);
      lastFocusMessage = `${focused.status}: ${focused.message}`;
      if (focused.status === "success") break;
      if (focused.status === "failed") {
        throw new Error(lastFocusMessage);
      }
    } catch (error) {
      lastFocusMessage = error instanceof Error ? error.message : String(error);
    }
    await browser.wait(300);
  }
  if (!lastFocusMessage.startsWith("success:")) {
    throw new Error(`review_required: provider input box not ready for upload; last=${lastFocusMessage}`);
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
  request: AiFeedInput;
  ref: UploadableAiFeedInputRef;
  expectedAttachmentCount: number;
}): Promise<void> => {
  const startedAtMs = Date.now();
  emitUploadStage({
    request: input.request,
    stage: "upload_file_clipboard_paste",
    status: "start",
    startedAtMs: null,
    refs: {
      inputRefId: input.ref.id,
      expectedAttachmentCount: input.expectedAttachmentCount,
    },
  });
  await uploadFileViaClipboardPaste(input.browser, input.context, input.ref.filePath, input.expectedAttachmentCount);
  emitUploadStage({
    request: input.request,
    stage: "upload_file_clipboard_paste",
    status: "success",
    startedAtMs,
    refs: {
      inputRefId: input.ref.id,
      expectedAttachmentCount: input.expectedAttachmentCount,
    },
  });
};

export const uploadFiles = async (
  browser: BrowserController,
  request: AiFeedInput,
  context: AiProviderAdapterContext,
): Promise<void> => {
  const refs = listUploadableRefs(request);
  if (refs.length > 0) {
    await clearComposer(browser, context);
  }
  for (const [index, ref] of refs.entries()) {
    await uploadSingleFileByClipboardPaste({ browser, context, request, ref, expectedAttachmentCount: index + 1 });
  }
};
