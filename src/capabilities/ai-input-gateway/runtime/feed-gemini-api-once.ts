import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import { geminiApiAdapter } from "../providers/gemini-api.adapter.js";
import type {
  AiFeedInput,
  AiFeedResult,
} from "../schema.js";
import { executeAiFeedOnce } from "./feed-provider-once.js";

export const feedGeminiApiOnce = async (input: {
  request: AiFeedInput;
  dataDir: string;
  runtimeLogger?: RuntimeLogger;
  adapter?: AiProviderAdapter;
  signal?: AbortSignal;
}): Promise<AiFeedResult> => {
  return executeAiFeedOnce({
    request: input.request,
    dataDir: input.dataDir,
    adapter: input.adapter ?? geminiApiAdapter,
    childCapabilityId: "feed-gemini-api-once",
    transport: "api",
    ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
};
