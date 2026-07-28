import { openChatGptNativeFilePicker, waitForExactAttachmentCount } from "./web-chat-page-actions.js";
import type {
  WebChatAttachmentTransportInput,
  WebChatAttachmentTransportResult,
} from "./web-chat-attachment-transport.js";

export const attachByNativePickerBatch = async (
  input: WebChatAttachmentTransportInput,
): Promise<WebChatAttachmentTransportResult> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: NATIVE_PICKER_PROVIDER_NOT_APPROVED");
  }
  if (input.files.length < 2) {
    throw new Error("review_required: NATIVE_PICKER_REQUIRES_MULTIPLE_FILES");
  }
  const picker = input.browser.selectFilesInNativePicker;
  if (!picker) {
    throw new Error("review_required: NATIVE_MULTI_FILE_PICKER_UNAVAILABLE");
  }
  await openChatGptNativeFilePicker(input.browser, input.context, input.expectedPageUrl);
  const expectedFileNames = input.files.map((file) => file.displayFileName);
  const selection = await picker.call(input.browser, {
    stagingDirectoryPath: input.stagingDirectoryPath,
    expectedFileNames,
    description: "select the exact approved staged file set",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!selection.ok) {
    throw new Error(`review_required: ${selection.message}`);
  }
  if (JSON.stringify(selection.observedFileNames) !== JSON.stringify(expectedFileNames)) {
    throw new Error(`review_required: NATIVE_PICKER_SELECTION_ORDER_MISMATCH; expected=${expectedFileNames.join("|")}; observed=${selection.observedFileNames.join("|")}`);
  }
  const evaluation = await waitForExactAttachmentCount(
    input.browser,
    input.context,
    input.files.length,
    expectedFileNames,
    120_000,
    {
      expectedPageUrl: input.expectedPageUrl,
      baselineAttachmentCount: 0,
      requireReady: true,
    },
  );
  return {
    transportKind: "native_picker_batch",
    detectedFileCount: evaluation.attachmentCount ?? input.files.length,
    uploadedFiles: input.files.map((file) => ({
      inputRefId: file.inputRefId,
      step: file.order,
      expectedAttachmentCount: input.files.length,
      detectedAttachmentCount: evaluation.attachmentCount ?? input.files.length,
      fileName: file.displayFileName,
      sha256: file.sha256,
      byteCount: file.byteCount,
    })),
  };
};
