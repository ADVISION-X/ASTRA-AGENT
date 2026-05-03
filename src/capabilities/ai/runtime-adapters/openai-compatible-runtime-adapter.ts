import { createHash, randomUUID } from "node:crypto";

import type { AiRuntimeExecutionOutput, AiRuntimeHealth, ParsedAiAbilityInput } from "../contract.js";
import type { AiRuntimeExecuteOptions, AiRuntimePort } from "../ports/ai-runtime-port.js";
import { AiRuntimeExecutionOutputSchema, AiRuntimeHealthSchema } from "../schema.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import { buildMapAuthoringTemplate } from "../../../map-plugins/authoring/map-authoring-template.js";
import { MapAuthoringAiOutputSchema } from "../../../map-plugins/authoring/map-authoring-ai-output.schema.js";
import { AiEvidencePacketAnalysisInputSchema } from "../schema.js";
import {
  getAiExternalProviderPublicState,
  resolveAiExternalProviderRuntimeConfig,
} from "../runtime/provider-config-store.js";

type OpenAiCompatibleRuntimeInput = {
  dataDir?: string | null;
};

type RuntimeState = {
  lastTaskType: ParsedAiAbilityInput["taskType"] | null;
  lastInvocationStatus: string | null;
  lastFailureReason: string | null;
};

function createRuntimeState(): RuntimeState {
  return {
    lastTaskType: null,
    lastInvocationStatus: null,
    lastFailureReason: null,
  };
}

function buildHealth(input: {
  implementationStatus: string;
  overallStatus: AiRuntimeHealth["overallStatus"];
  model: string | null;
  detail: string;
  state: RuntimeState;
}): AiRuntimeHealth {
  const model = input.model ?? "not-configured";
  return AiRuntimeHealthSchema.parse({
    overallStatus: input.overallStatus,
    implementationStatus: input.implementationStatus,
    dependencies: {
      gateway: input.detail,
      vision: "not_applicable",
      text: input.detail,
      ocr: "not_applicable",
    },
    configuredModels: {
      vision: "not_applicable",
      commentUnderstanding: model,
      ocr: "not_applicable",
      productSignal: model,
    },
    availableModels: input.model ? [input.model] : [],
    lastCheckedAt: new Date().toISOString(),
    failureReason: input.overallStatus === "ready" ? null : input.detail,
    lastTaskType: input.state.lastTaskType,
    lastFailureReason: input.state.lastFailureReason,
    lastInvocationStatus: input.state.lastInvocationStatus,
  });
}

function buildFailureOutput(input: {
  implementationStatus: string;
  modelName: string;
  failureReason: string;
}): AiRuntimeExecutionOutput {
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: "paid",
    modelName: input.modelName,
    modelRole: "future",
    runtime: "openai-compatible",
    implementationStatus: input.implementationStatus,
    createdAt: null,
    confidence: null,
    costEstimate: null,
    output: null,
    rawOutputRef: null,
    rawOutputHash: null,
    runtimeCallId: null,
    timeoutMs: null,
    attemptIndex: 0,
    retryCount: 0,
    circuitBreakerState: "not_applicable",
    gatewayDurationMs: null,
    modelHealthBefore: input.failureReason,
    modelHealthAfter: input.failureReason,
  });
}

function buildRawOutputProof(taskType: string, rawOutput: string) {
  const outputHash = createHash("sha256").update(rawOutput).digest("hex");
  return {
    rawOutputRef: `ai-runtime://openai-compatible/${taskType}/${randomUUID()}`,
    rawOutputHash: `sha256:${outputHash}`,
  };
}

function resolveConfidence(output: unknown): number | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const candidate = output as { confidence?: unknown; score?: unknown };
  if (typeof candidate.confidence === "number") {
    return candidate.confidence;
  }
  if (typeof candidate.score === "number") {
    return candidate.score;
  }
  return null;
}

function normalizeOutput(request: ParsedAiAbilityInput, output: unknown): unknown {
  if (request.taskType === "map_authoring") {
    return MapAuthoringAiOutputSchema.parse(output);
  }
  return output;
}

function buildMapAuthoringMessages(request: Extract<ParsedAiAbilityInput, { taskType: "map_authoring" }>) {
  return {
    system: [
      "You are a GrassEye map authoring model.",
      "Return JSON only.",
      "Do not include markdown fences.",
      "Output keys: draftPackage, humanReadableExplanation, requiredClarifications, riskWarnings, validationHints, needsCapabilityExpansion, draftStatus.",
      "draftPackage must be declarative map data only and must never contain executable code.",
    ].join("\n"),
    user: [
      buildMapAuthoringTemplate(request.input),
      "Return a JSON object with:",
      "- draftPackage: declarative draft sections for task template, operational map, dependencies, policy, and prompt bindings.",
      "- humanReadableExplanation: brief operator-facing explanation.",
      "- requiredClarifications: array of strings.",
      "- riskWarnings: array of strings.",
      "- validationHints: array of strings.",
      "- needsCapabilityExpansion: boolean.",
      "- draftStatus: draft_ready or needs_clarification.",
      "Target platform profile must match the request.",
    ].join("\n\n"),
  };
}

function buildEvidencePacketMessages(request: Extract<ParsedAiAbilityInput, { taskType: "evidence_packet_analysis" }>) {
  const typedInput = AiEvidencePacketAnalysisInputSchema.parse(request.input);
  return {
    system: [
      "You analyze governed evidence packets for GrassEye.",
      "Return JSON only.",
      "Preserve evidenceIds exactly.",
    ].join("\n"),
    user: JSON.stringify(typedInput, null, 2),
  };
}

function buildMessages(request: ParsedAiAbilityInput) {
  switch (request.taskType) {
    case "map_authoring":
      return buildMapAuthoringMessages(request);
    case "evidence_packet_analysis":
      return buildEvidencePacketMessages(request);
    default:
      return null;
  }
}

function parseResponseText(payload: unknown): { responseId: string | null; model: string | null; text: string | null } {
  if (!payload || typeof payload !== "object") {
    return { responseId: null, model: null, text: null };
  }
  const typed = payload as {
    id?: unknown;
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const firstChoice = Array.isArray(typed.choices) ? typed.choices[0] : null;
  return {
    responseId: typeof typed.id === "string" ? typed.id : null,
    model: typeof typed.model === "string" ? typed.model : null,
    text: typeof firstChoice?.message?.content === "string" ? firstChoice.message.content : null,
  };
}

async function callOpenAiCompatible(
  request: ParsedAiAbilityInput,
  input: OpenAiCompatibleRuntimeInput,
  options?: AiRuntimeExecuteOptions,
): Promise<AiRuntimeExecutionOutput> {
  if (!input.dataDir) {
    return buildFailureOutput({
      implementationStatus: "provider_not_configured",
      modelName: "not-configured",
      failureReason: "provider_not_configured",
    });
  }

  const config = await resolveAiExternalProviderRuntimeConfig(input.dataDir, {
    providerConfigRef: request.providerPolicy.providerConfigRef,
    secretRef: request.providerPolicy.secretRef,
  });
  if (config === null) {
    return buildFailureOutput({
      implementationStatus: "provider_not_configured",
      modelName: "not-configured",
      failureReason: "provider_not_configured",
    });
  }

  const messages = buildMessages(request);
  if (messages === null) {
    return buildFailureOutput({
      implementationStatus: "task_type_mismatch",
      modelName: config.model,
      failureReason: "task_type_mismatch",
    });
  }

  const startedAt = Date.now();
  let payload: unknown;
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
      signal: options?.signal ?? null,
    });

    payload = await response.json();
    if (!response.ok) {
      return buildFailureOutput({
        implementationStatus: "runtime_http_failed",
        modelName: config.model,
        failureReason: typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
          ? (payload as { error?: { message?: string } }).error?.message ?? "runtime_http_failed"
          : "runtime_http_failed",
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return buildFailureOutput({
        implementationStatus: "runtime_timeout",
        modelName: config.model,
        failureReason: "runtime_timeout",
      });
    }
    return buildFailureOutput({
      implementationStatus: "runtime_threw",
      modelName: config.model,
      failureReason: error instanceof Error ? error.message : "runtime_threw",
    });
  }

  const parsedResponse = parseResponseText(payload);
  if (!parsedResponse.text) {
    return buildFailureOutput({
      implementationStatus: "runtime_invalid_response",
      modelName: parsedResponse.model ?? config.model,
      failureReason: "runtime_invalid_response",
    });
  }

  const extracted = parseExtractedJson(parsedResponse.text);
  if (!extracted.ok) {
    return buildFailureOutput({
      implementationStatus: "runtime_invalid_response",
      modelName: parsedResponse.model ?? config.model,
      failureReason: "runtime_invalid_response",
    });
  }

  const proof = buildRawOutputProof(request.taskType, parsedResponse.text);
  let normalizedOutput: unknown;
  try {
    normalizedOutput = normalizeOutput(request, extracted.value);
  } catch {
    return buildFailureOutput({
      implementationStatus: "runtime_invalid_response",
      modelName: parsedResponse.model ?? config.model,
      failureReason: "runtime_invalid_response",
    });
  }
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: "paid",
    modelName: parsedResponse.model ?? config.model,
    modelRole: "future",
    runtime: "openai-compatible",
    implementationStatus: "external_runtime",
    createdAt: new Date().toISOString(),
    confidence: resolveConfidence(normalizedOutput),
    costEstimate: null,
    output: normalizedOutput,
    rawOutputRef: proof.rawOutputRef,
    rawOutputHash: proof.rawOutputHash,
    runtimeCallId: parsedResponse.responseId ?? randomUUID(),
    timeoutMs: null,
    attemptIndex: 0,
    retryCount: 0,
    circuitBreakerState: "not_applicable",
    gatewayDurationMs: Date.now() - startedAt,
    modelHealthBefore: "configured",
    modelHealthAfter: "ok",
  });
}

export function createOpenAiCompatibleRuntimePort(input: OpenAiCompatibleRuntimeInput = {}): AiRuntimePort {
  const state = createRuntimeState();
  const loadHealth = async () => {
    if (!input.dataDir) {
      const health = buildHealth({
        implementationStatus: "provider_not_configured",
        overallStatus: "degraded",
        model: null,
        detail: "external provider dataDir unavailable",
        state,
      });
      return { ok: true, detail: health.dependencies.gateway, health };
    }

    const providerState = await getAiExternalProviderPublicState(input.dataDir);
    const health = buildHealth({
      implementationStatus: providerState.configured ? "provider_ready" : "provider_not_configured",
      overallStatus: providerState.configured && providerState.enabled ? "ready" : "degraded",
      model: providerState.model,
      detail: providerState.configured
        ? `openai-compatible:${providerState.model}`
        : "openai-compatible:not-configured",
      state,
    });
    return { ok: true, detail: health.dependencies.gateway, health };
  };

  return {
    async execute(request, options) {
      const result = await callOpenAiCompatible(request, input, options);
      state.lastTaskType = request.taskType;
      state.lastInvocationStatus = result.createdAt === null ? "failed" : "success";
      state.lastFailureReason = result.createdAt === null ? result.implementationStatus : null;
      return result;
    },

    async getHealth() {
      return loadHealth();
    },

    async getRuntimeHealth() {
      return (await loadHealth()).health;
    },
  };
}
