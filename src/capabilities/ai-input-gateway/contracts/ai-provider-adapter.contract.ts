import type { BrowserController } from "../../../lib/browser/browser-controller.js";
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
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  tokenEstimateUnavailableReason?: string | null;
};

export type AiProviderAdapterContext = {
  dataDir: string;
  browser?: BrowserController;
  abortSignal?: AbortSignal;
};

export interface AiProviderAdapter {
  readonly providerKind: AiInputGatewayProviderKind;
  feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse>;
}
