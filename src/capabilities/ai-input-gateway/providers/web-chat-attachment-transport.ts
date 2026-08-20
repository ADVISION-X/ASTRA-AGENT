import type {
  AiProviderAdapterContext,
  AiProviderUploadedFileProof,
  WebChatAttachmentTransportKind,
} from "../contracts/ai-provider-adapter.contract.js";
import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiFeedInput } from "../schema.js";

export type StagedWebChatAttachment = {
  inputRefId: string;
  artifactRef: string;
  order: number;
  sourceFileName: string;
  displayFileName: string;
  stagedFilePath: string;
  sha256: `sha256:${string}`;
  byteCount: number;
};

export type AttachmentMutationBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait" | "attachFile">;

export type WebChatAttachmentTransportInput = {
  browser: AttachmentMutationBrowser;
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
