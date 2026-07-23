import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AiInputGatewayAbilityGroup,
  AiInputGatewayExecuteOptions,
  AiInputGatewayExecutionContext,
} from "./contract.js";
import {
  AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
  AiFeedInputSchema,
  type AiFeedInput,
  type AiFeedResult,
  type AiInputGatewayChildCapabilityId,
} from "./schema.js";
import { feedGeminiApiOnce } from "./runtime/feed-gemini-api-once.js";
import { feedGeminiWebChatOnce } from "./runtime/feed-gemini-web-chat-once.js";
import { feedGptWebChatOnce } from "./runtime/feed-gpt-web-chat-once.js";

const CHILD_CAPABILITY_IDS: AiInputGatewayChildCapabilityId[] = [
  "feed-gemini-api-once",
  "feed-gemini-web-chat-once",
  "feed-gpt-web-chat-once",
  "attach-approved-web-chat-files-once",
];

const childForProvider = (input: AiFeedInput): AiInputGatewayChildCapabilityId => {
  if (input.providerKind === "gemini-api") return "feed-gemini-api-once";
  if (input.providerKind === "gemini-web-chat") return "feed-gemini-web-chat-once";
  return "feed-gpt-web-chat-once";
};

const executeGeminiApi = (
  context: AiInputGatewayExecutionContext,
  request: AiFeedInput,
  signal: AbortSignal | undefined,
): Promise<AiFeedResult> => feedGeminiApiOnce({
    request,
    dataDir: context.dataDir,
    ...(context.runtimeLogger ? { runtimeLogger: context.runtimeLogger } : {}),
    ...(signal ? { signal } : {}),
    ...(context.adapters?.["gemini-api"] ? { adapter: context.adapters["gemini-api"] } : {}),
  });

const executeGeminiWebChat = (
  context: AiInputGatewayExecutionContext,
  browser: BrowserController | undefined,
  request: AiFeedInput,
  signal: AbortSignal | undefined,
  onAttachmentUploadCompleted: AiInputGatewayExecuteOptions["onAttachmentUploadCompleted"],
): Promise<AiFeedResult> => feedGeminiWebChatOnce({
    request,
    dataDir: context.dataDir,
    ...(context.runtimeLogger ? { runtimeLogger: context.runtimeLogger } : {}),
    ...(signal ? { signal } : {}),
    ...(onAttachmentUploadCompleted ? { onAttachmentUploadCompleted } : {}),
    ...(browser ? { browser } : {}),
    ...(context.adapters?.["gemini-web-chat"] ? { adapter: context.adapters["gemini-web-chat"] } : {}),
  });

const executeGptWebChat = (
  context: AiInputGatewayExecutionContext,
  browser: BrowserController | undefined,
  request: AiFeedInput,
  signal: AbortSignal | undefined,
  onAttachmentUploadCompleted: AiInputGatewayExecuteOptions["onAttachmentUploadCompleted"],
): Promise<AiFeedResult> => feedGptWebChatOnce({
    request,
    dataDir: context.dataDir,
    ...(context.runtimeLogger ? { runtimeLogger: context.runtimeLogger } : {}),
    ...(signal ? { signal } : {}),
    ...(onAttachmentUploadCompleted ? { onAttachmentUploadCompleted } : {}),
    ...(browser ? { browser } : {}),
    ...(context.adapters?.["gpt-web-chat"] ? { adapter: context.adapters["gpt-web-chat"] } : {}),
  });

const executeParsedRequest = (
  context: AiInputGatewayExecutionContext,
  browser: BrowserController | undefined,
  request: AiFeedInput,
  signal: AbortSignal | undefined,
  onAttachmentUploadCompleted: AiInputGatewayExecuteOptions["onAttachmentUploadCompleted"],
): Promise<AiFeedResult> => {
  const childCapabilityId = childForProvider(request);
  if (childCapabilityId === "feed-gemini-api-once") return executeGeminiApi(context, request, signal);
  if (childCapabilityId === "feed-gemini-web-chat-once") {
    return executeGeminiWebChat(
      context,
      browser,
      request,
      signal,
      onAttachmentUploadCompleted,
    );
  }
  return executeGptWebChat(context, browser, request, signal, onAttachmentUploadCompleted);
};

export const createAiInputGatewayAbilityGroup = (
  context: AiInputGatewayExecutionContext,
  browser?: BrowserController,
): AiInputGatewayAbilityGroup => ({
  abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,

  listChildCapabilityIds(): AiInputGatewayChildCapabilityId[] {
    return [...CHILD_CAPABILITY_IDS];
  },

  execute(rawInput: unknown, options): Promise<AiFeedResult> {
    const request = AiFeedInputSchema.parse(rawInput);
    return executeParsedRequest(
      context,
      browser,
      request,
      options?.signal,
      options?.onAttachmentUploadCompleted,
    );
  },
});
