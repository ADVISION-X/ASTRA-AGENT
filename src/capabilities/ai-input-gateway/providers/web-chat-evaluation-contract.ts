type WebChatActionStatus = "success" | "review_required" | "failed" | "pending";

export type WebChatEvaluation = {
  status: WebChatActionStatus;
  message: string;
  answerText?: string | null;
  pageUrl?: string | null;
  selector?: string | null;
  generating?: boolean;
  target?: "composer-plus" | "upload-menu-item";
  x?: number;
  y?: number;
  assistantCount?: number;
  composerText?: string | null;
  expectedLength?: number;
  attachmentCount?: number;
  attachmentNames?: string[];
  missingFileNames?: string[];
  unexpectedFileNames?: string[];
  attachmentScope?: "input" | "global" | "none";
  boundAttachmentCount?: number;
  lastUserMessageText?: string | null;
  inputFocused?: boolean;
  promptPrefixVisible?: boolean;
  promptSuffixVisible?: boolean;
  pastedTextCardReady?: boolean;
  hasPastedTextCard?: boolean;
  sendReady?: boolean;
};
