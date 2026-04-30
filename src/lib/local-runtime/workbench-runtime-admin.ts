import path from "node:path";
import { readFile } from "node:fs/promises";

import type { CommanderAuditSummary } from "../../capabilities/commander-console/index.js";
import { loadLocalAiModelConfig, type LocalAiModelConfig, type LocalModelRole } from "../local-ai/model-config.js";

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
  buildLocalAiRoleControls(await loadLocalAiModelConfig());

export const setLocalAiRoleStartupState = async (input: {
  role: LocalModelRole;
  enabled: boolean;
}): Promise<unknown> => {
  if (!input.enabled) {
    throw new Error(`Role ${input.role} cannot be disabled because phase-04 full-enforcement posture requires all configured local AI roles at startup.`);
  }
  return {
    ...buildLocalAiRoleControls(await loadLocalAiModelConfig()),
    mutation: {
      role: input.role,
      requestedEnabled: input.enabled,
      applied: false,
      status: "accepted-noop" as const,
      message: `Role ${input.role} is already required at startup under the phase-04 full-enforcement posture.`,
    },
  };
};

export const readAuditSummary = async (): Promise<CommanderAuditSummary> => {
  try {
    const [runnerSummaryText, phaseGateText] = await Promise.all([
      readFile(path.join(process.cwd(), "scripts", "audit", "generated", "runner-summary.json"), "utf8"),
      readFile(path.join(process.cwd(), "scripts", "audit", "phase-gates", "phase-04-full-enforcement.json"), "utf8"),
    ]);
    const runnerSummary = JSON.parse(runnerSummaryText) as { generatedAt?: string; totals?: CommanderAuditSummary["totals"] };
    const phaseGate = JSON.parse(phaseGateText) as { phase: string; activeCapabilityDomains: string[] };
    return {
      phase: phaseGate.phase,
      activeCapabilityDomains: phaseGate.activeCapabilityDomains,
      lastGeneratedAt: phaseGate.phase ? runnerSummary.generatedAt ?? null : null,
      lastRunGeneratedAt: runnerSummary.generatedAt ?? null,
      totals: runnerSummary.totals ?? null,
    };
  } catch {
    return { phase: "phase-04-full-enforcement", activeCapabilityDomains: [], lastGeneratedAt: null, lastRunGeneratedAt: null, totals: null };
  }
};