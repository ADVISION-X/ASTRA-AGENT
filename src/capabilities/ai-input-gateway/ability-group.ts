import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
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
import { readWebChatBrowserMutationLaneState, resolveWebChatMaxInFlight } from "./runtime/web-chat-concurrency-lease.js";
import { recoverCheckpointedWebChatProviderLease } from "./providers/web-chat-checkpoint-response.js";
import { classifyWebChatFailure } from "./failure-classification.js";
import { createProviderOperatorControl } from "./runtime/provider-operator-control.js";
import { governProductionGptExecutionProfileInput } from "./provider-execution-profile.js";

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

interface WebChatExecutionInput {
  context: AiInputGatewayExecutionContext;
  browser: BrowserTargetLease | undefined;
  request: AiFeedInput;
  options: AiInputGatewayExecuteOptions | undefined;
}

const executeGeminiWebChat = (input: WebChatExecutionInput): Promise<AiFeedResult> =>
  feedGeminiWebChatOnce({
    request: input.request,
    dataDir: input.context.dataDir,
    ...(input.context.runtimeLogger ? { runtimeLogger: input.context.runtimeLogger } : {}),
    ...(input.options?.signal ? { signal: input.options.signal } : {}),
    ...(input.options?.executionId ? { executionId: input.options.executionId } : {}),
    ...(input.options?.supersededExecutionId
      ? { supersededExecutionId: input.options.supersededExecutionId } : {}),
    ...(input.options?.submissionAdmission
      ? { submissionAdmission: input.options.submissionAdmission } : {}),
    ...(input.options?.onAttachmentUploadCompleted
      ? { onAttachmentUploadCompleted: input.options.onAttachmentUploadCompleted } : {}),
    ...(input.options?.onProgress ? { onProgress: input.options.onProgress } : {}),
    ...(input.options?.onPageActionCommitted
      ? { onPageActionCommitted: input.options.onPageActionCommitted }
      : {}),
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.context.adapters?.["gemini-web-chat"]
      ? { adapter: input.context.adapters["gemini-web-chat"] } : {}),
  });

const executeGptWebChat = (input: WebChatExecutionInput): Promise<AiFeedResult> =>
  feedGptWebChatOnce({
    request: input.request,
    dataDir: input.context.dataDir,
    ...(input.context.runtimeLogger ? { runtimeLogger: input.context.runtimeLogger } : {}),
    ...(input.options?.signal ? { signal: input.options.signal } : {}),
    ...(input.options?.executionId ? { executionId: input.options.executionId } : {}),
    ...(input.options?.supersededExecutionId
      ? { supersededExecutionId: input.options.supersededExecutionId } : {}),
    ...(input.options?.submissionAdmission
      ? { submissionAdmission: input.options.submissionAdmission } : {}),
    ...(input.options?.onAttachmentUploadCompleted
      ? { onAttachmentUploadCompleted: input.options.onAttachmentUploadCompleted } : {}),
    ...(input.options?.onProgress ? { onProgress: input.options.onProgress } : {}),
    ...(input.options?.onPageActionCommitted
      ? { onPageActionCommitted: input.options.onPageActionCommitted }
      : {}),
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.context.adapters?.["gpt-web-chat"]
      ? { adapter: input.context.adapters["gpt-web-chat"] } : {}),
  });

const executeParsedRequest = (input: WebChatExecutionInput): Promise<AiFeedResult> => {
  const childCapabilityId = childForProvider(input.request);
  if (childCapabilityId === "feed-gemini-api-once") {
    return executeGeminiApi(input.context, input.request, input.options?.signal);
  }
  if (childCapabilityId === "feed-gemini-web-chat-once") return executeGeminiWebChat(input);
  return executeGptWebChat(input);
};

type ProviderOperatorControl = ReturnType<typeof createProviderOperatorControl>;

const buildAiInputGatewaySurface = (
  context: AiInputGatewayExecutionContext,
  browser: BrowserTargetLease | undefined,
  operatorControl: ProviderOperatorControl,
): AiInputGatewayAbilityGroup => ({
  abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
  listChildCapabilityIds: () => [...CHILD_CAPABILITY_IDS],
  getRuntimeCapacity: () => resolveWebChatMaxInFlight(),
  getBrowserMutationLaneState: () => readWebChatBrowserMutationLaneState(context.dataDir),
  releaseProviderTargetForOperator: (ownerKey) => operatorControl.release(ownerKey),
  resumeProviderTargetAfterOperator: (ownerKey) => operatorControl.resume(ownerKey),
  close: () => operatorControl.close(),
  classifyFailure: (error, hasDurableSubmission) =>
    classifyWebChatFailure(error, hasDurableSubmission),
  recoverCheckpointedProviderLease: (input) =>
    recoverCheckpointedWebChatProviderLease({ dataDir: context.dataDir, ...input }),
  async execute(rawInput: unknown, options): Promise<AiFeedResult> {
    const request = AiFeedInputSchema.parse(governProductionGptExecutionProfileInput(rawInput));
    if (browser && request.providerKind !== "gemini-api") {
      await operatorControl.waitForRelease(options?.signal);
    }
    return executeParsedRequest({
      context,
      browser: options?.browser ?? browser,
      request,
      options,
    });
  },
});

export const createAiInputGatewayAbilityGroup = (
  context: AiInputGatewayExecutionContext,
  browser?: BrowserTargetLease,
): AiInputGatewayAbilityGroup => {
  const operatorControl = createProviderOperatorControl();
  return buildAiInputGatewaySurface(context, browser, operatorControl);
};
