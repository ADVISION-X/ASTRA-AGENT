import type { BrowserTargetSession } from "../../lib/browser/browser-controller.js";
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
import { resolveWebChatMaxInFlight } from "./runtime/web-chat-concurrency-lease.js";
import {
  acquireWebChatBrowserMutationLease,
  acquireWebChatCapacityLease,
} from "./runtime/web-chat-concurrency-lease.js";
import {
  recoverCheckpointedWebChatProviderLease,
} from "./providers/web-chat-checkpoint-response.js";
import { classifyWebChatFailure } from "./failure-classification.js";
import { createProviderOperatorControl } from "./runtime/provider-operator-control.js";
import { attachApprovedWebChatFilesOnce } from "./children/attach-approved-web-chat-files-once.js";
import { openProviderPage } from "./providers/web-chat-open.js";
import {
  clearComposer,
  waitForExactAttachmentCount,
} from "./providers/web-chat-upload-page-actions.js";
import { dismissChatGptSearchDialogIfVisible } from "./providers/web-chat-search-dialog-hygiene.js";

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
  browser: BrowserTargetSession | undefined;
  request: AiFeedInput;
  options: AiInputGatewayExecuteOptions | undefined;
}

const executeGeminiWebChat = (
  input: WebChatExecutionInput,
): Promise<AiFeedResult> => feedGeminiWebChatOnce({
    request: input.request,
    dataDir: input.context.dataDir,
    ...(input.context.runtimeLogger
      ? { runtimeLogger: input.context.runtimeLogger }
      : {}),
    ...(input.options?.signal ? { signal: input.options.signal } : {}),
    ...(input.options?.executionId
      ? { executionId: input.options.executionId }
      : {}),
    ...(input.options?.supersededExecutionId
      ? { supersededExecutionId: input.options.supersededExecutionId }
      : {}),
    ...(input.options?.onAttachmentUploadCompleted
      ? { onAttachmentUploadCompleted: input.options.onAttachmentUploadCompleted }
      : {}),
    ...(input.options?.onProgress
      ? { onProgress: input.options.onProgress }
      : {}),
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.context.adapters?.["gemini-web-chat"]
      ? { adapter: input.context.adapters["gemini-web-chat"] }
      : {}),
	  });

const executeGptWebChat = (
  input: WebChatExecutionInput,
): Promise<AiFeedResult> => feedGptWebChatOnce({
    request: input.request,
    dataDir: input.context.dataDir,
    ...(input.context.runtimeLogger
      ? { runtimeLogger: input.context.runtimeLogger }
      : {}),
    ...(input.options?.signal ? { signal: input.options.signal } : {}),
    ...(input.options?.executionId
      ? { executionId: input.options.executionId }
      : {}),
    ...(input.options?.supersededExecutionId
      ? { supersededExecutionId: input.options.supersededExecutionId }
      : {}),
    ...(input.options?.onAttachmentUploadCompleted
      ? { onAttachmentUploadCompleted: input.options.onAttachmentUploadCompleted }
      : {}),
    ...(input.options?.onProgress
      ? { onProgress: input.options.onProgress }
      : {}),
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.context.adapters?.["gpt-web-chat"]
      ? { adapter: input.context.adapters["gpt-web-chat"] }
      : {}),
	  });

const executeParsedRequest = (
  input: WebChatExecutionInput,
): Promise<AiFeedResult> => {
  const childCapabilityId = childForProvider(input.request);
  if (childCapabilityId === "feed-gemini-api-once") {
    return executeGeminiApi(
      input.context,
      input.request,
      input.options?.signal,
    );
  }
  if (childCapabilityId === "feed-gemini-web-chat-once") {
    return executeGeminiWebChat(input);
  }
  return executeGptWebChat(input);
};

type ProviderOperatorControl = ReturnType<typeof createProviderOperatorControl>;

const runPreflightAttachment = async (input: {
  context: AiInputGatewayExecutionContext;
  browser: BrowserTargetSession;
  request: AiFeedInput;
  signal?: AbortSignal;
}) => {
  const adapterContext = {
    dataDir: input.context.dataDir,
    browser: input.browser,
    ...(input.context.runtimeLogger ? { runtimeLogger: input.context.runtimeLogger } : {}),
    ...(input.signal ? { abortSignal: input.signal } : {}),
  };
  await openProviderPage({
    browser: input.browser,
    providerUrl: "https://chatgpt.com/",
    runtimeName: "gpt-web-chat-provider-input-preflight",
    context: adapterContext,
    request: input.request,
  });
  await dismissChatGptSearchDialogIfVisible(input.browser, adapterContext);
  const result = await attachApprovedWebChatFilesOnce({
    browser: input.browser,
    request: input.request,
    context: adapterContext,
  });
  const cleared = await clearComposer(input.browser, adapterContext);
  if (cleared.status !== "success" || !cleared.pageUrl) {
    throw new Error(`review_required: provider preflight cleanup was not proven; ${cleared.message}`);
  }
  await waitForExactAttachmentCount(input.browser, adapterContext, 0, [], 10_000, {
    expectedPageUrl: cleared.pageUrl,
    baselineAttachmentCount: 0,
    requireReady: false,
    requireComposerTextEmpty: true,
  });
  return result;
};

const preflightApprovedWebChatFiles = async (input: {
  rawInput: unknown;
  options: Pick<AiInputGatewayExecuteOptions, "signal"> | undefined;
  context: AiInputGatewayExecutionContext;
  browser: BrowserTargetSession | undefined;
  operatorControl: ProviderOperatorControl;
}) => {
  const request = AiFeedInputSchema.parse(input.rawInput);
  if (!input.browser || request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: GPT web-chat provider target is required for attachment preflight.");
  }
  await input.operatorControl.waitForRelease(input.options?.signal);
  input.operatorControl.ensureHousekeeping();
  const capacityLease = await acquireWebChatCapacityLease({
    dataDir: input.context.dataDir,
    timeoutMs: request.timeoutMs,
    ...(input.options?.signal ? { signal: input.options.signal } : {}),
  });
  let mutationLease: Awaited<ReturnType<typeof acquireWebChatBrowserMutationLease>> | null = null;
  try {
    mutationLease = await acquireWebChatBrowserMutationLease({
      dataDir: input.context.dataDir,
      timeoutMs: request.timeoutMs,
      ...(input.options?.signal ? { signal: input.options.signal } : {}),
    });
    return await runPreflightAttachment({
      context: input.context,
      browser: input.browser,
      request,
      ...(input.options?.signal ? { signal: input.options.signal } : {}),
    });
  } finally {
    await mutationLease?.release();
    await capacityLease.release();
  }
};

const buildAiInputGatewaySurface = (
  context: AiInputGatewayExecutionContext,
  browser: BrowserTargetSession | undefined,
  operatorControl: ProviderOperatorControl,
): AiInputGatewayAbilityGroup => ({
    abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,

    listChildCapabilityIds(): AiInputGatewayChildCapabilityId[] {
      return [...CHILD_CAPABILITY_IDS];
    },

    getRuntimeCapacity(): number {
      return resolveWebChatMaxInFlight();
    },

    async releaseProviderTargetForOperator(ownerKey: string): Promise<boolean> {
      return operatorControl.release(ownerKey);
    },

    resumeProviderTargetAfterOperator(ownerKey: string): void {
      operatorControl.resume(ownerKey);
    },

    close(): Promise<void> {
      return operatorControl.close();
    },

    classifyFailure(error, hasDurableSubmission) {
      return classifyWebChatFailure(error, hasDurableSubmission);
    },

    recoverCheckpointedProviderLease(input): Promise<string | null> {
      return recoverCheckpointedWebChatProviderLease({
        dataDir: context.dataDir,
        ...input,
      });
    },

    preflightApprovedWebChatFiles(rawInput, options) {
      return preflightApprovedWebChatFiles({
        rawInput,
        options,
        context,
        browser,
        operatorControl,
      });
    },

    async execute(rawInput: unknown, options): Promise<AiFeedResult> {
      const request = AiFeedInputSchema.parse(rawInput);
      if (browser && request.providerKind !== "gemini-api") {
        await operatorControl.waitForRelease(options?.signal);
        operatorControl.ensureHousekeeping();
      }
      return executeParsedRequest({
        context,
        browser,
        request,
        options,
      });
    },
  });

export const createAiInputGatewayAbilityGroup = (
  context: AiInputGatewayExecutionContext,
  browser?: BrowserTargetSession,
): AiInputGatewayAbilityGroup => {
  const operatorControl = createProviderOperatorControl(context, browser);
  return buildAiInputGatewaySurface(context, browser, operatorControl);
};
