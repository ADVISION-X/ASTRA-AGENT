import { createHash } from "node:crypto";

import { resolveOpenTargetDefaults } from "../../capabilities/open/registry.js";
import { getLocalAppShellMapRegistry } from "../../map-plugins/registry/local-app-shell-map-registry.js";

type ActiveRegistry = ReturnType<typeof getLocalAppShellMapRegistry>["active"];
type TaskTemplateLaunchRecord = NonNullable<ReturnType<ActiveRegistry["getActiveOperationalMapRecordByTaskTemplateId"]>>;
type ActiveMapRecord = NonNullable<ReturnType<ActiveRegistry["getActiveOperationalMapRecord"]>>;

export type RequestedPlatformId =
  | "facebook-web"
  | "tiktok-web"
  | "macos-local"
  | "iphone-mirroring-facebook-app"
  | "iphone-mirroring-tiktok-app";

export type UserRequirementSelectedPlatformId = Extract<RequestedPlatformId, "facebook-web" | "tiktok-web">;

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

export type MissionStartBindingInput = {
  taskTemplateId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
};

type MissionStartBindingFailure = {
  ok: false;
  failureReason: string;
  actionableMessage: string;
  nextAction: string;
};

type MissionStartBindingSuccess = {
  ok: true;
  taskTemplateId: string;
  activationId: string;
  activationSnapshotRef: string;
  requestedPlatformId: RequestedPlatformId;
  selectedMapId: string;
  targetProfileRef: string;
  targetUrl: string;
  targetTitle: string;
  selectedRuntimeId?: string;
  selectedPlatforms?: UserRequirementSelectedPlatformId[];
  primaryPlatformId?: UserRequirementSelectedPlatformId;
  userRequirementRef?: string;
  userRequirementText?: string;
  targetProfiles?: Partial<Record<UserRequirementSelectedPlatformId, VisualMissionTargetProfileBinding>>;
};

export type MissionStartBinding = MissionStartBindingFailure | MissionStartBindingSuccess;

const createBindingFailure = (failureReason: string, actionableMessage: string, nextAction: string): MissionStartBindingFailure => {
  return { ok: false, failureReason, actionableMessage, nextAction };
};

const VISUAL_MISSION_RUNTIME_ID = "visual-mission-runtime-v1";

function isUserRequirementSelectedPlatformId(value: unknown): value is UserRequirementSelectedPlatformId {
  return value === "facebook-web" || value === "tiktok-web";
}

function buildUserRequirementRef(text: string): string {
  return `user-requirement:${createHash("sha256").update(text.trim()).digest("hex").slice(0, 16)}`;
}

const resolveMissingTargetDefaults = (selectedMapId: string, targetProfileRef: string): MissionStartBindingFailure => (
  createBindingFailure(
    `selectedMapId=${selectedMapId} targetProfileRef=${targetProfileRef} cannot resolve governed target defaults before mission start.`,
    "任务无法启动，因为激活地图的 targetProfileRef 不能解析出受治理 targetUrl/targetTitle；禁止把目标字段留空后再进入运行时。",
    "修复该地图绑定的 Open target profile，使 start-mission 在派发前拿到显式 targetUrl 和 targetTitle。",
  )
);

const createBindingSuccess = (
  binding: TaskTemplateLaunchRecord | ActiveMapRecord,
  requestedPlatformId: RequestedPlatformId,
  selectedMapId: string,
): MissionStartBinding => {
  if (!binding.targetProfileRef) {
    throw new Error(`Active launch record ${selectedMapId} is missing targetProfileRef after binding validation.`);
  }

  const targetDefaults = resolveOpenTargetDefaults(binding.targetProfileRef);
  if (!targetDefaults) {
    return resolveMissingTargetDefaults(selectedMapId, binding.targetProfileRef);
  }

  return {
    ok: true,
    taskTemplateId: binding.taskTemplateId,
    activationId: binding.activationId,
    activationSnapshotRef: binding.activationSnapshotRef,
    requestedPlatformId,
    selectedMapId,
    targetProfileRef: targetDefaults.targetProfileRef,
    targetUrl: targetDefaults.targetUrl,
    targetTitle: targetDefaults.targetTitle,
  };
};

const resolveMissingTargetProfile = (selectedMapId: string): MissionStartBindingFailure =>
  createBindingFailure(
    `selectedMapId=${selectedMapId} is missing targetProfileRef before mission start.`,
    "任务无法启动，因为激活地图缺少显式 targetProfileRef；禁止在启动后静默默认。",
    "重新激活带有 open-target-profile 绑定的地图包，然后再次启动任务。",
  );

const resolveTemplateBindingConflict = (input: MissionStartBindingInput, binding: TaskTemplateLaunchRecord): MissionStartBindingFailure | null => {
  if (input.selectedMapId && input.selectedMapId !== binding.mapId) {
    return createBindingFailure(
      `taskTemplateId=${input.taskTemplateId} conflicts with selectedMapId=${input.selectedMapId}.`,
      "任务模板与显式地图绑定不一致，任务已被拦截。",
      "移除显式 selectedMapId，或改用与任务模板一致的激活地图。",
    );
  }
  if (input.requestedPlatformId && input.requestedPlatformId !== binding.requestedPlatformId) {
    return createBindingFailure(
      `taskTemplateId=${input.taskTemplateId} conflicts with requestedPlatformId=${input.requestedPlatformId}.`,
      "任务模板与显式平台绑定不一致，任务已被拦截。",
      "移除显式 requestedPlatformId，或改用与任务模板一致的平台任务模板。",
    );
  }
  return null;
};

const resolveTaskTemplateBinding = (activeRegistry: ActiveRegistry, input: MissionStartBindingInput): MissionStartBinding => {
  const binding = input.taskTemplateId ? activeRegistry.getActiveOperationalMapRecordByTaskTemplateId(input.taskTemplateId) : null;
  if (!binding || !binding.requestedPlatformId) {
    return createBindingFailure(
      `taskTemplateId=${input.taskTemplateId} is not bound to an active approved launch record.`,
      "任务模板未绑定到已激活批准地图，无法启动任务。",
      "选择一个已激活批准的任务模板，或先完成该地图包的激活。",
    );
  }

  const conflict = resolveTemplateBindingConflict(input, binding);
  if (conflict) {
    return conflict;
  }
  return binding.targetProfileRef
    ? createBindingSuccess(binding, binding.requestedPlatformId, binding.mapId)
    : resolveMissingTargetProfile(binding.mapId);
};

const resolveExplicitBinding = (activeRegistry: ActiveRegistry, input: MissionStartBindingInput): MissionStartBinding => {
  if (!input.requestedPlatformId || !input.selectedMapId) {
    return createBindingFailure(
      "requestedPlatformId and selectedMapId are both required before mission start.",
      "任务无法启动，因为缺少 taskTemplateId 或显式地图绑定。",
      "回到开始页选择一个已激活批准的任务模板；不要在用户侧手工填写内部地图字段。",
    );
  }

  const record = activeRegistry.getActiveOperationalMapRecord(input.selectedMapId);
  if (!record) {
    return createBindingFailure(
      `selectedMapId=${input.selectedMapId} is not an active approved map.`,
      "显式地图绑定未对应到已激活批准地图，任务已被拦截。",
      "改用已激活批准的地图，或改为通过任务模板启动。",
    );
  }
  if (record.requestedPlatformId !== input.requestedPlatformId) {
    return createBindingFailure(
      `selectedMapId=${input.selectedMapId} is bound to requestedPlatformId=${record.requestedPlatformId}, not ${input.requestedPlatformId}.`,
      "显式地图与平台绑定不一致，任务已被拦截。",
      "选择与地图绑定一致的平台，或直接使用任务模板启动。",
    );
  }

  return record.targetProfileRef
    ? createBindingSuccess(record, input.requestedPlatformId, input.selectedMapId)
    : resolveMissingTargetProfile(input.selectedMapId);
};

export function normalizeRequestedPlatformId(value?: string): RequestedPlatformId | null {
  return value === "tiktok-web"
    || value === "facebook-web"
    || value === "iphone-mirroring-facebook-app"
    || value === "iphone-mirroring-tiktok-app"
    ? value
    : null;
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

export function resolveMissionStartBinding(input: MissionStartBindingInput): MissionStartBinding {
  const activeRegistry = getLocalAppShellMapRegistry().active;
  return input.taskTemplateId
    ? resolveTaskTemplateBinding(activeRegistry, input)
    : resolveExplicitBinding(activeRegistry, input);
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

  const primaryPlatformId = selectedPlatforms[0]!;
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
