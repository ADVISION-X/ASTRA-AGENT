import type { AiRuntimeExecutionOutput } from "../contract.js";
import {
  buildExternalProviderFailureOutput,
} from "./external-provider-runtime-response.js";

type ExternalRuntimeConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

const buildRuntimeErrorOutput = (modelName: string, error: unknown): AiRuntimeExecutionOutput => {
  if (error instanceof Error && error.name === "AbortError") {
    return buildExternalProviderFailureOutput({
      implementationStatus: "runtime_timeout",
      modelName,
      failureReason: "runtime_timeout",
    });
  }

  return buildExternalProviderFailureOutput({
    implementationStatus: "runtime_threw",
    modelName,
    failureReason: error instanceof Error ? error.message : "runtime_threw",
  });
};

const resolveHttpFailureReason = (payload: unknown): string => (
  typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
    ? (payload as { error?: { message?: string } }).error?.message ?? "runtime_http_failed"
    : "runtime_http_failed"
);

export async function requestExternalPayload(
  config: ExternalRuntimeConfig,
  messages: { system: string; user: string },
  signal?: AbortSignal | null,
): Promise<{ ok: true; payload: unknown } | { ok: false; output: AiRuntimeExecutionOutput }> {
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
      }),
      signal: signal ?? null,
    });
    const payload = await response.json();
    if (response.ok) {
      return { ok: true, payload };
    }

    return {
      ok: false,
      output: buildExternalProviderFailureOutput({
        implementationStatus: "runtime_http_failed",
        modelName: config.model,
        failureReason: resolveHttpFailureReason(payload),
      }),
    };
  } catch (error) {
    return { ok: false, output: buildRuntimeErrorOutput(config.model, error) };
  }
}
