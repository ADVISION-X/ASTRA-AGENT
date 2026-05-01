import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import type { LocalAiRuntimeAdapterHealth, LocalAiDebugHook } from "./local-ai-runtime-adapter.js";
import { fetchJsonWithTimeout } from "./runtime-adapter-utils.js";

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>;
};

type OllamaGenerateResponse = {
  response?: string;
};

const truncatePreview = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}...`;
};

const shouldIncludeFullAiIo = () => process.env.GRASSEYE_DEBUG_AI_IO === "full";

export async function listOllamaAvailableModels(baseUrl: string): Promise<string[]> {
  const response = await fetchJsonWithTimeout(`${baseUrl}/api/tags`, { method: "GET", timeoutMs: 8_000 });
  const parsed = response as OllamaTagsResponse;
  return (parsed.models ?? [])
    .map((model) => model.name?.trim() ?? "")
    .filter((modelName) => modelName.length > 0);
}

export async function buildOllamaRuntimeHealth(runtime: "ollama", baseUrl: string): Promise<LocalAiRuntimeAdapterHealth> {
  try {
    const availableModels = await listOllamaAvailableModels(baseUrl);
    return {
      runtime,
      status: "ready",
      detail: `ollama reachable with ${availableModels.length} local models`,
      availableModels,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      runtime,
      status: message.includes("HTTP 404") ? "missing" : "unreachable",
      detail: message,
      availableModels: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function ensureOllamaModelAvailable(baseUrl: string, modelName: string): Promise<void> {
  const availableModels = await listOllamaAvailableModels(baseUrl);
  if (!availableModels.includes(modelName)) {
    throw new LocalAiRuntimeError(
      "model_missing",
      `Ollama model ${modelName} is not installed locally.`,
      JSON.stringify({ availableModels }),
    );
  }
}

export async function invokeOllamaGenerate(input: {
  baseUrl: string;
  runtime: "ollama";
  model: string;
  prompt: string;
  images?: string[];
  timeoutMs: number;
  debugHook?: LocalAiDebugHook;
}): Promise<string> {
  const startedAt = Date.now();
  const response = await fetchJsonWithTimeout(`${input.baseUrl}/api/generate`, {
    method: "POST",
    timeoutMs: input.timeoutMs,
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      stream: false,
      ...(input.images ? { images: input.images } : {}),
    }),
  });
  const parsed = response as OllamaGenerateResponse;
  if (!parsed.response || parsed.response.trim().length === 0) {
    throw new LocalAiRuntimeError("invalid_output", `Ollama ${input.model} returned an empty response.`);
  }

  await input.debugHook?.({
    eventType: "local_ai_adapter_response_received",
    detail: `runtime=ollama; model=${input.model}; responsePreview=${truncatePreview(parsed.response)}`,
    modelName: input.model,
    runtime: input.runtime,
    rawResponsePreview: truncatePreview(parsed.response),
    ...(shouldIncludeFullAiIo() ? { rawResponseText: parsed.response } : {}),
    durationMs: Date.now() - startedAt,
  });

  return parsed.response;
}