import { getModelRoleConfig, loadLocalAiModelConfig, type LocalAiModelConfig } from "./model-config.js";
import { getPromptContract, getRequiredModelRole, listPromptContracts } from "./prompt-registry.js";
import { executeGovernedTask } from "./governed-task-execution.js";
import { LocalAiTaskRequestSchema, type LocalAiTaskRequest, type LocalAiTaskResult } from "../../types/local-ai.js";

export class LocalAiGateway {
  private readonly modelConfigPromise: Promise<LocalAiModelConfig>;

  constructor(options?: { modelConfig?: LocalAiModelConfig; modelConfigPromise?: Promise<LocalAiModelConfig> }) {
    this.modelConfigPromise = options?.modelConfig
      ? Promise.resolve(options.modelConfig)
      : options?.modelConfigPromise ?? loadLocalAiModelConfig();
  }

  async getHealth(): Promise<{ ok: boolean; detail: string }> {
    try {
      const modelConfig = await this.modelConfigPromise;
      return {
        ok: true,
        detail: `local AI config ready with ${Object.keys(modelConfig.roles).length} governed model roles and ${listPromptContracts().length} prompt contracts; implementationStatus=governed-heuristic`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        detail: `local AI config error: ${message}`
      };
    }
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

  async execute(requestInput: LocalAiTaskRequest): Promise<LocalAiTaskResult> {
    const request = LocalAiTaskRequestSchema.parse(requestInput);
    const roleConfig = await this.resolveGovernedRoleConfig(request);
    return executeGovernedTask(request, roleConfig, new Date().toISOString());
  }
}