import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type {
  AiFeedInput,
  AiInputGatewayProviderKind,
} from "../schema.js";

export type AiProviderRawResponse = {
  rawText: string;
  modelName: string | null;
  runtimeName: string;
  transport: "api" | "web-chat";
  webChatUrl: string | null;
  sourcePageUrlBeforeFeed: string | null;
  restoredSourcePage: boolean | null;
  outputRefs?: string[];
  providerTabPolicy?: string | null;
  providerRecoveryAttemptCount?: number | null;
  providerRecoveryStatus?: string | null;
  staleConversationCleanupStatus?: string | null;
  staleConversationHistoryCleanupStatus?: string | null;
  webChatWorkspaceId?: string | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  tokenEstimateUnavailableReason?: string | null;
};

export type AiProviderAdapterContext = {
  dataDir: string;
  browser?: BrowserController;
  runtimeLogger?: RuntimeLogger;
  abortSignal?: AbortSignal;
};

export interface AiProviderAdapter {
  readonly providerKind: AiInputGatewayProviderKind;
  feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse>;
}
