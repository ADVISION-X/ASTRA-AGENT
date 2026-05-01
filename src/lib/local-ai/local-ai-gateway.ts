import { getModelRoleConfig, loadLocalAiModelConfig, type LocalAiModelConfig } from "./model-config.js";
import { getPromptContract, getRequiredModelRole, listPromptContracts } from "./prompt-registry.js";
import { executeRuntimeTask } from "./local-ai-runtime-execution.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import {
  buildLocalAiHealthDetail,
  buildReadyHealth,
  buildUnavailableHealth,
  getInvocationStatusFromRuntimeError,
  type LocalAiExecutionSnapshot,
} from "./local-ai-gateway-health.js";
import { LocalOcrRuntimeAdapter } from "./runtime-adapters/local-ocr-runtime-adapter.js";
import { OllamaRuntimeAdapter } from "./runtime-adapters/ollama-runtime-adapter.js";
import type { LocalAiDebugHook } from "./runtime-adapters/local-ai-runtime-adapter.js";
import { executeGovernedTask } from "./governed-task-execution.js";
import {
  LocalAiTaskRequestSchema,
  type LocalAiHealth,
  type LocalAiInvocationStatus,
  type LocalAiTaskRequest,
  type LocalAiTaskResult,
} from "../../types/local-ai.js";

type LocalAiExecutionMode = "real-platform" | "fixture_mode" | "demo_mode" | "dev_stub_mode";

export class LocalAiGateway {
  private readonly modelConfigPromise: Promise<LocalAiModelConfig>;
  private readonly ollamaAdapter: OllamaRuntimeAdapter;
  private readonly ocrAdapter: LocalOcrRuntimeAdapter;
  private lastTaskType: LocalAiTaskRequest["taskType"] | null = null;
  private lastFailureReason: string | null = null;
  private lastInvocationStatus: LocalAiInvocationStatus | null = null;

  constructor(options?: { modelConfig?: LocalAiModelConfig; modelConfigPromise?: Promise<LocalAiModelConfig> }) {
    this.modelConfigPromise = options?.modelConfig
      ? Promise.resolve(options.modelConfig)
      : options?.modelConfigPromise ?? loadLocalAiModelConfig();
    this.ollamaAdapter = new OllamaRuntimeAdapter();
    this.ocrAdapter = new LocalOcrRuntimeAdapter();
  }

  private getInvocationSnapshot(): LocalAiExecutionSnapshot {
    return {
      lastTaskType: this.lastTaskType,
      lastFailureReason: this.lastFailureReason,
      lastInvocationStatus: this.lastInvocationStatus,
    };
  }

  async getHealth(): Promise<{ ok: boolean; detail: string; health: LocalAiHealth }> {
    try {
      const modelConfig = await this.modelConfigPromise;
      const [ollamaHealth, ocrHealth] = await Promise.all([this.ollamaAdapter.getHealth(), this.ocrAdapter.getHealth()]);
      const health = buildReadyHealth(this.getInvocationSnapshot(), modelConfig, ollamaHealth, ocrHealth);
      return {
        ok: health.overallStatus === "ready",
        detail: buildLocalAiHealthDetail(health, listPromptContracts().length),
        health,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const health = buildUnavailableHealth(this.getInvocationSnapshot(), message);
      return {
        ok: false,
        detail: `local AI config error: ${message}`,
        health,
      };
    }
  }

  async getRuntimeHealth(): Promise<LocalAiHealth> {
    const report = await this.getHealth();
    return report.health;
  }

  async resolveGovernedRoleConfig(request: LocalAiTaskRequest) {
    const contract = getPromptContract(request.taskType);
    const expectedModelRole = getRequiredModelRole(request.taskType);
    const modelConfig = await this.modelConfigPromise;
    const roleConfig = getModelRoleConfig(modelConfig, expectedModelRole);

    if (request.modelRole !== expectedModelRole) {
      throw new Error(`Local AI request modelRole ${request.modelRole} does not match governed role ${expectedModelRole} for ${request.taskType}.`);
    }
    if (request.promptVersion !== contract.promptVersion || request.schemaVersion !== contract.schemaVersion) {
      throw new Error(`Local AI request contract drift detected for ${request.taskType}.`);
    }
    if (roleConfig.promptVersion !== contract.promptVersion || roleConfig.schemaVersion !== contract.schemaVersion) {
      throw new Error(`Local AI model config drift detected for ${request.taskType}.`);
    }

    return roleConfig;
  }

  async execute(requestInput: LocalAiTaskRequest, options?: { executionMode?: LocalAiExecutionMode; debugHook?: LocalAiDebugHook }): Promise<LocalAiTaskResult> {
    const request = LocalAiTaskRequestSchema.parse(requestInput);
    const roleConfig = await this.resolveGovernedRoleConfig(request);
    this.lastTaskType = request.taskType;

    if (options?.executionMode && options.executionMode !== "real-platform") {
      this.lastInvocationStatus = "success";
      this.lastFailureReason = null;
      return executeGovernedTask(request, roleConfig, new Date().toISOString());
    }

    try {
      const result = await executeRuntimeTask({
        request,
        roleConfig,
        ollamaAdapter: this.ollamaAdapter,
        ocrAdapter: this.ocrAdapter,
        ...(options?.debugHook ? { debugHook: options.debugHook } : {}),
      });
      this.lastInvocationStatus = "success";
      this.lastFailureReason = null;
      return result;
    } catch (error) {
      if (error instanceof LocalAiRuntimeError) {
        this.lastFailureReason = error.message;
        this.lastInvocationStatus = getInvocationStatusFromRuntimeError(error);
      }
      throw error;
    }
  }
}