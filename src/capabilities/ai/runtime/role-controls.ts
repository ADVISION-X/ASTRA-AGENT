import { loadAiOwnedLocalModelConfig, type LocalAiModelConfig, type LocalModelRole } from "./local-ai-model-config.js";

const buildLocalAiRoleControls = (config: LocalAiModelConfig) => ({
  phase: config.phase,
  executionPosture: config.executionPosture,
  allowCloudFallback: config.allowCloudFallback,
  allowPaidApi: config.allowPaidApi,
  allowMockForAcceptance: config.allowMockForAcceptance,
  roles: Object.values(config.roles).map((roleConfig) => ({
    role: roleConfig.role,
    enabled: true,
    startupState: "required" as const,
    provider: roleConfig.provider,
    runtime: roleConfig.runtime,
    model: roleConfig.model,
    executionMode: roleConfig.executionMode,
    promptVersion: roleConfig.promptVersion,
    schemaVersion: roleConfig.schemaVersion,
    failureBehavior: roleConfig.failureBehavior,
    requiredForPhase: roleConfig.requiredForPhase,
  })),
});

export const getLocalAiRoleControls = async (): Promise<unknown> =>
  buildLocalAiRoleControls(await loadAiOwnedLocalModelConfig());

export const setLocalAiRoleStartupState = async (input: {
  role: LocalModelRole;
  enabled: boolean;
}): Promise<unknown> => {
  if (!input.enabled) {
    throw new Error(`Role ${input.role} cannot be disabled because phase-04 full-enforcement posture requires all configured local AI roles at startup.`);
  }
  return {
    ...buildLocalAiRoleControls(await loadAiOwnedLocalModelConfig()),
    mutation: {
      role: input.role,
      requestedEnabled: input.enabled,
      applied: false,
      status: "accepted-noop" as const,
      message: `Role ${input.role} is already required at startup under the phase-04 full-enforcement posture.`,
    },
  };
};