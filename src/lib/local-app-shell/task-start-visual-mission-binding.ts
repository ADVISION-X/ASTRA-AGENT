import { createHash } from "node:crypto";

import { resolveOpenTargetDefaults } from "../../capabilities/open/registry.js";
import { getLocalAppShellMapRegistry } from "../../map-plugins/registry/local-app-shell-map-registry.js";
import {
  createBindingFailure,
  resolveMissingTargetDefaults,
  type MissionStartBinding,
  type MissionStartBindingFailure,
  type UserRequirementSelectedPlatformId,
} from "./task-start-legacy-binding.js";

type ActiveRegistry = ReturnType<typeof getLocalAppShellMapRegistry>["active"];

type VisualMissionTargetProfileBinding = {
  requestedPlatformId: UserRequirementSelectedPlatformId;
  selectedMapId: string;
  taskTemplateId: string;
  activationId: string;
  activationSnapshotRef: string;
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

const VISUAL_MISSION_RUNTIME_ID = "visual-mission-runtime-v1";

function isUserRequirementSelectedPlatformId(value: unknown): value is UserRequirementSelectedPlatformId {
  return value === "facebook-web" || value === "tiktok-web";
}

function buildUserRequirementRef(text: string): string {
  return `user-requirement:${createHash("sha256").update(text.trim()).digest("hex").slice(0, 16)}`;
}

function resolveVisualMissionTargetBinding(
  activeRegistry: ActiveRegistry,
  platformId: UserRequirementSelectedPlatformId,
): VisualMissionTargetProfileBinding | MissionStartBindingFailure {
  const record = [...activeRegistry.listActiveOperationalMapRecords()]
    .filter((entry) => entry.requestedPlatformId === platformId && entry.targetProfileRef)
    .sort((left, right) => left.mapId.localeCompare(right.mapId))[0] ?? null;
  if (!record || !record.targetProfileRef) {
    return createBindingFailure(
      `requestedPlatformId=${platformId} has no active approved visual mission binding.`,
      `任务无法启动，因为 ${platformId} 还没有可用的受治理视觉任务绑定。`,
      "先激活该平台的受治理 visual mission map/runtime 绑定，再重新启动。",
    );
  }

  const targetDefaults = resolveOpenTargetDefaults(record.targetProfileRef);
  if (!targetDefaults) {
    return resolveMissingTargetDefaults(record.mapId, record.targetProfileRef);
  }

  return {
    requestedPlatformId: platformId,
    selectedMapId: record.mapId,
    taskTemplateId: record.taskTemplateId,
    activationId: record.activationId,
    activationSnapshotRef: record.activationSnapshotRef,
    targetProfileRef: targetDefaults.targetProfileRef,
    targetUrl: targetDefaults.targetUrl,
    targetTitle: targetDefaults.targetTitle,
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
}): Required<RunLimitInput> {
  return {
    maxRounds: input.draft.maxRounds ?? input.defaultMaxRounds,
    maxMinutes: input.draft.maxMinutes ?? input.defaultMaxMinutes,
  };
}

export function resolveVisualMissionStartBinding(input: VisualMissionStartBindingInput): MissionStartBinding {
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

  const activeRegistry = getLocalAppShellMapRegistry().active;
  const targetProfiles: Partial<Record<UserRequirementSelectedPlatformId, VisualMissionTargetProfileBinding>> = {};
  for (const platformId of selectedPlatforms) {
    const binding = resolveVisualMissionTargetBinding(activeRegistry, platformId);
    if ("ok" in binding) {
      return binding;
    }
    targetProfiles[platformId] = binding;
  }

  const [primaryPlatformId] = selectedPlatforms;
  if (!primaryPlatformId) {
    return createBindingFailure(
      "visual mission primary platform binding is missing.",
      "任务无法启动，因为主平台绑定丢失。",
      "重新选择平台并重试；如果仍失败，检查 active map registry。",
    );
  }
  const primaryBinding = targetProfiles[primaryPlatformId];
  if (!primaryBinding) {
    return createBindingFailure(
      "visual mission primary platform binding is missing.",
      "任务无法启动，因为主平台绑定丢失。",
      "重新选择平台并重试；如果仍失败，检查 active map registry。",
    );
  }

  return {
    ok: true,
    taskTemplateId: primaryBinding.taskTemplateId,
    activationId: primaryBinding.activationId,
    activationSnapshotRef: primaryBinding.activationSnapshotRef,
    requestedPlatformId: primaryBinding.requestedPlatformId,
    selectedMapId: primaryBinding.selectedMapId,
    targetProfileRef: primaryBinding.targetProfileRef,
    targetUrl: primaryBinding.targetUrl,
    targetTitle: primaryBinding.targetTitle,
    selectedRuntimeId: VISUAL_MISSION_RUNTIME_ID,
    selectedPlatforms,
    primaryPlatformId,
    userRequirementRef: buildUserRequirementRef(userRequirementText),
    userRequirementText,
    targetProfiles,
  };
}