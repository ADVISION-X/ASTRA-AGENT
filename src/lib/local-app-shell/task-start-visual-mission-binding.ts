import { createHash } from "node:crypto";

import { resolveVisualMissionPlatformTarget } from "../../visual-mission/platform-target-registry.js";
import {
  createBindingFailure,
  type MissionStartBinding,
  type MissionStartBindingFailure,
  type UserRequirementSelectedPlatformId,
} from "./task-start-binding-contract.js";

type VisualMissionTargetProfileBinding = {
  requestedPlatformId: UserRequirementSelectedPlatformId;
  targetProfileRef: string;
  targetUrl: string;
  targetTitle: string;
};

export type VisualMissionStartBindingInput = {
  selectedPlatforms: UserRequirementSelectedPlatformId[];
  userRequirementText: string;
};

type RunLimitInput = {
  maxRounds: number | undefined;
  maxMinutes: number | undefined;
};

function isUserRequirementSelectedPlatformId(value: unknown): value is UserRequirementSelectedPlatformId {
  return value === "facebook-web" || value === "tiktok-web";
}

function buildUserRequirementRef(text: string): string {
  return `user-requirement:${createHash("sha256").update(text.trim()).digest("hex").slice(0, 16)}`;
}

function resolveVisualMissionTargetBinding(
  platformId: UserRequirementSelectedPlatformId,
): VisualMissionTargetProfileBinding | MissionStartBindingFailure {
  const targetBinding = resolveVisualMissionPlatformTarget(platformId);
  if (!targetBinding) {
    return createBindingFailure(
      `requestedPlatformId=${platformId} has no governed visual mission platform target binding.`,
      `任务无法启动，因为 ${platformId} 还没有可用的受治理视觉任务绑定。`,
      "先补齐该平台的 visual mission platform target registry 绑定，再重新启动。",
    );
  }

  return {
    requestedPlatformId: platformId,
    targetProfileRef: targetBinding.targetProfileRef,
    targetUrl: targetBinding.targetUrl,
    targetTitle: targetBinding.targetTitle,
  };
}

export function normalizeSelectedPlatforms(value: unknown): UserRequirementSelectedPlatformId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.filter(isUserRequirementSelectedPlatformId)));
}

export function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : undefined;
}

export function resolveStartRunLimits(input: {
  defaultMaxRounds: number;
  defaultMaxMinutes: number;
  draft: RunLimitInput;
}): { maxRounds: number; maxMinutes: number } {
  return {
    maxRounds: input.draft.maxRounds ?? input.defaultMaxRounds,
    maxMinutes: input.draft.maxMinutes ?? input.defaultMaxMinutes,
  };
}

function validateVisualMissionStartInput(input: VisualMissionStartBindingInput): {
  selectedPlatforms: UserRequirementSelectedPlatformId[];
  userRequirementText: string;
} | MissionStartBindingFailure {
  const selectedPlatforms = input.selectedPlatforms.filter(isUserRequirementSelectedPlatformId);
  const userRequirementText = input.userRequirementText.trim();
  if (!userRequirementText) {
    return createBindingFailure(
      "userRequirementText is required before visual mission start.",
      "任务无法启动，因为用户需求为空。",
      "先填写用户需求，再发起视觉任务。",
    );
  }
  if (selectedPlatforms.length === 0) {
    return createBindingFailure(
      "selectedPlatforms must contain at least one governed platform.",
      "任务无法启动，因为没有选择任何平台。",
      "至少勾选一个受治理平台后再启动。",
    );
  }
  return { selectedPlatforms, userRequirementText };
}

function resolveVisualMissionTargetProfiles(selectedPlatforms: UserRequirementSelectedPlatformId[]): Partial<Record<UserRequirementSelectedPlatformId, VisualMissionTargetProfileBinding>> | MissionStartBindingFailure {
  const targetProfiles: Partial<Record<UserRequirementSelectedPlatformId, VisualMissionTargetProfileBinding>> = {};
  for (const platformId of selectedPlatforms) {
    const binding = resolveVisualMissionTargetBinding(platformId);
    if ("ok" in binding) {
      return binding;
    }
    targetProfiles[platformId] = binding;
  }
  return targetProfiles;
}

function resolvePrimaryVisualMissionBinding(input: {
  selectedPlatforms: UserRequirementSelectedPlatformId[];
  targetProfiles: Partial<Record<UserRequirementSelectedPlatformId, VisualMissionTargetProfileBinding>>;
}): VisualMissionTargetProfileBinding | MissionStartBindingFailure {
  const [primaryPlatformId] = input.selectedPlatforms;
  if (!primaryPlatformId) {
    return createBindingFailure(
      "visual mission primary platform binding is missing.",
      "任务无法启动，因为主平台绑定丢失。",
      "重新选择平台并重试；如果仍失败，检查 visual mission platform target registry。",
    );
  }
  const primaryBinding = input.targetProfiles[primaryPlatformId];
  if (!primaryBinding) {
    return createBindingFailure(
      "visual mission primary platform binding is missing.",
      "任务无法启动，因为主平台绑定丢失。",
      "重新选择平台并重试；如果仍失败，检查 visual mission platform target registry。",
    );
  }
  return primaryBinding;
}

export function resolveVisualMissionStartBinding(input: VisualMissionStartBindingInput): MissionStartBinding {
  const validated = validateVisualMissionStartInput(input);
  if ("ok" in validated) {
    return validated;
  }
  const targetProfiles = resolveVisualMissionTargetProfiles(validated.selectedPlatforms);
  if ("ok" in targetProfiles) {
    return targetProfiles;
  }
  const primaryBinding = resolvePrimaryVisualMissionBinding({
    selectedPlatforms: validated.selectedPlatforms,
    targetProfiles,
  });
  if ("ok" in primaryBinding) {
    return primaryBinding;
  }

  return {
    ok: true,
    requestedPlatformId: primaryBinding.requestedPlatformId,
    targetProfileRef: primaryBinding.targetProfileRef,
    targetUrl: primaryBinding.targetUrl,
    targetTitle: primaryBinding.targetTitle,
    userRequirementRef: buildUserRequirementRef(validated.userRequirementText),
  };
}