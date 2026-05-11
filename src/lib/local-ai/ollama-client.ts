// Internal Ollama HTTP client. Not exported in index.ts.
// IMPORTANT: qwen2.5vl:3b is a Chat-Instruct model. Must use /api/chat, not /api/generate.
// Using /api/generate causes chat-template token bleed (model outputs <|im_start|> tokens).

type OllamaTagsResponse = { models?: Array<{ name?: string }> };
type OllamaChatMessage = { role: "user" | "assistant" | "system"; content: string; images?: string[] };
type OllamaChatResponse = { message?: { role?: string; content?: string } };

function createAbortContext(timeoutMs: number, externalSignal?: AbortSignal) {
  if (externalSignal) {
    return { requestSignal: externalSignal, clear: () => undefined };
  }
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(`Local AI timed out after ${timeoutMs}ms.`), timeoutMs);
  return { requestSignal: controller.signal, clear: () => clearTimeout(handle) };
}

async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number }): Promise<unknown> {
  const { timeoutMs = 10_000, signal: _externalSignal, ...rest } = init;
  const ctx = createAbortContext(timeoutMs, _externalSignal as AbortSignal | undefined);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: ctx.requestSignal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...((rest.headers as Record<string, string>) ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Local AI HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Local AI request aborted or timed out: ${error.message}`);
    }
    throw error;
  } finally {
    ctx.clear();
  }
}

export async function listAvailableModels(endpoint: string): Promise<string[]> {
  const response = await fetchJson(`${endpoint}/api/tags`, { method: "GET", timeoutMs: 8_000 }) as OllamaTagsResponse;
  return (response.models ?? []).map((m) => m.name?.trim() ?? "").filter(Boolean);
}

export async function invokeOllama(input: {
  endpoint: string;
  modelName: string;
  promptText: string;
  /** Pre-normalized base64 strings from prepareModelSafeImage — file I/O handled upstream. */
  imageBase64s?: string[];
  timeoutMs: number;
  abortSignal?: AbortSignal;
  /**
   * Ollama structured output schema (JSON Schema object).
   * When provided, Ollama uses grammar-constrained decoding to enforce the exact output structure.
   * Falls back to format:"json" (syntax-only constraint) when not provided.
   */
  outputSchema?: Record<string, unknown>;
}): Promise<{ rawText: string; imageCount: number }> {
  const images = input.imageBase64s && input.imageBase64s.length > 0 ? input.imageBase64s : undefined;

  const userMessage: OllamaChatMessage = {
    role: "user",
    content: input.promptText,
    ...(images ? { images } : {}),
  };

  const response = await fetchJson(`${input.endpoint}/api/chat`, {
    method: "POST",
    timeoutMs: input.timeoutMs,
    ...(input.abortSignal ? { signal: input.abortSignal } : {}),
    body: JSON.stringify({
      model: input.modelName,
      messages: [userMessage],
      stream: false,
      // Ollama constrained decoding:
      //   - When outputSchema is provided: grammar-constrained to the exact JSON Schema (structure + types).
      //   - Fallback "json": only guarantees syntactically valid JSON — does NOT constrain schema structure.
      //   Never omit this field: qwen2.5vl:3b (3B) cannot reliably output governed JSON without token-level constraints.
      format: input.outputSchema !== undefined ? input.outputSchema : "json",
    }),
  }) as OllamaChatResponse;

  const content = response.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error(`Ollama ${input.modelName} returned an empty response via /api/chat.`);
  }

  return { rawText: content, imageCount: images?.length ?? 0 };
}
