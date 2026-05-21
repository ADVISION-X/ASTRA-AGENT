import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AiInputGatewayAbilityGroup,
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
];

const childForProvider = (input: AiFeedInput): AiInputGatewayChildCapabilityId => {
  if (input.providerKind === "gemini-api") return "feed-gemini-api-once";
  if (input.providerKind === "gemini-web-chat") return "feed-gemini-web-chat-once";
  return "feed-gpt-web-chat-once";
};

export const createAiInputGatewayAbilityGroup = (
  context: AiInputGatewayExecutionContext,
  browser?: BrowserController,
): AiInputGatewayAbilityGroup => ({
  abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,

  listChildCapabilityIds(): AiInputGatewayChildCapabilityId[] {
    return [...CHILD_CAPABILITY_IDS];
  },

  execute(rawInput: unknown, options?: { signal?: AbortSignal }): Promise<AiFeedResult> {
    const request = AiFeedInputSchema.parse(rawInput);
    const childCapabilityId = childForProvider(request);
    if (childCapabilityId === "feed-gemini-api-once") {
      return feedGeminiApiOnce({
        request,
        dataDir: context.dataDir,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(context.adapters?.["gemini-api"] ? { adapter: context.adapters["gemini-api"] } : {}),
      });
    }
    if (childCapabilityId === "feed-gemini-web-chat-once") {
      return feedGeminiWebChatOnce({
        request,
        dataDir: context.dataDir,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(browser ? { browser } : {}),
        ...(context.adapters?.["gemini-web-chat"] ? { adapter: context.adapters["gemini-web-chat"] } : {}),
      });
    }
    return feedGptWebChatOnce({
      request,
      dataDir: context.dataDir,
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(browser ? { browser } : {}),
      ...(context.adapters?.["gpt-web-chat"] ? { adapter: context.adapters["gpt-web-chat"] } : {}),
    });
  },
});
