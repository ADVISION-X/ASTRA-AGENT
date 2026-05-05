import { getLocalAppShellMapRegistry } from "../../map-plugins/registry/local-app-shell-map-registry.js";

type ActiveRegistry = ReturnType<typeof getLocalAppShellMapRegistry>["active"];
type TaskTemplateLaunchRecord = NonNullable<ReturnType<ActiveRegistry["getActiveOperationalMapRecordByTaskTemplateId"]>>;
type ActiveMapRecord = NonNullable<ReturnType<ActiveRegistry["getActiveOperationalMapRecord"]>>;

export type RequestedPlatformId =
  | "facebook-web"
  | "tiktok-web"
  | "iphone-mirroring-facebook-app"
  | "iphone-mirroring-tiktok-app";

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
};

export type MissionStartBinding = MissionStartBindingFailure | MissionStartBindingSuccess;

const createBindingFailure = (failureReason: string, actionableMessage: string, nextAction: string): MissionStartBindingFailure => {
  return { ok: false, failureReason, actionableMessage, nextAction };
};

const createBindingSuccess = (binding: TaskTemplateLaunchRecord | ActiveMapRecord, requestedPlatformId: RequestedPlatformId, selectedMapId: string): MissionStartBindingSuccess => {
  if (!binding.targetProfileRef) {
    throw new Error(`Active launch record ${selectedMapId} is missing targetProfileRef after binding validation.`);
  }
  return {
    ok: true,
    taskTemplateId: binding.taskTemplateId,
    activationId: binding.activationId,
    activationSnapshotRef: binding.activationSnapshotRef,
    requestedPlatformId,
    selectedMapId,
    targetProfileRef: binding.targetProfileRef,
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

export function normalizePositiveInteger(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max ? value : undefined;
}

export function clampStartRunLimits(taskTemplateId: string, input: RunLimitInput): Required<RunLimitInput> {
  const task = getLocalAppShellMapRegistry().active.listOrdinaryTaskTemplates()
    .find((template) => template.taskTemplateId === taskTemplateId);
  const defaultRunLimit = task?.defaultRunLimit ?? { maxRounds: 3, maxMinutes: 20 };
  const maxAllowedRunLimit = task?.maxAllowedRunLimit ?? defaultRunLimit;
  return {
    maxRounds: Math.max(1, Math.min(input.maxRounds ?? defaultRunLimit.maxRounds, maxAllowedRunLimit.maxRounds)),
    maxMinutes: Math.max(1, Math.min(input.maxMinutes ?? defaultRunLimit.maxMinutes, maxAllowedRunLimit.maxMinutes)),
  };
}

export function resolveMissionStartBinding(input: MissionStartBindingInput): MissionStartBinding {
  const activeRegistry = getLocalAppShellMapRegistry().active;
  return input.taskTemplateId
    ? resolveTaskTemplateBinding(activeRegistry, input)
    : resolveExplicitBinding(activeRegistry, input);
}
