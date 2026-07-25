import type {
  AiProviderAdapterContext,
  AiProviderUploadedFileProof,
  WebChatAttachmentTransportKind,
} from "../contracts/ai-provider-adapter.contract.js";
import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiFeedInput } from "../schema.js";

export type StagedWebChatAttachment = {
  inputRefId: string;
  order: number;
  sourceFileName: string;
  displayFileName: string;
  stagedFilePath: string;
  sha256: `sha256:${string}`;
  byteCount: number;
};

export type WebChatAttachmentTransportInput = {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  stagingDirectoryPath: string;
  files: StagedWebChatAttachment[];
  expectedPageUrl: string;
};

export type WebChatAttachmentTransportResult = {
  transportKind: Exclude<WebChatAttachmentTransportKind, "skipped">;
  uploadedFiles: AiProviderUploadedFileProof[];
  detectedFileCount: number;
};
