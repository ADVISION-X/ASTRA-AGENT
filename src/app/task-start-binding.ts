import { getDefaultMapPluginRegistry } from "../map-plugins/registry/map-plugin-registry.js";

export type RequestedPlatformId = "facebook-web" | "tiktok-web";

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
  requestedPlatformId: RequestedPlatformId;
  selectedMapId: string;
};

export type MissionStartBinding = MissionStartBindingFailure | MissionStartBindingSuccess;

const createBindingFailure = (failureReason: string, actionableMessage: string, nextAction: string): MissionStartBindingFailure => {
  return { ok: false, failureReason, actionableMessage, nextAction };
};

const resolveTaskTemplateBinding = (input: {
  taskTemplateId: string;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
}): MissionStartBinding => {
  const binding = getDefaultMapPluginRegistry().active.getTaskTemplateDeveloperBinding(input.taskTemplateId);
  if (!binding || !binding.requestedPlatformId) {
    return createBindingFailure(
      `taskTemplateId=${input.taskTemplateId} is not bound to an active approved launch record.`,
      "任务模板未绑定到已激活批准地图，无法启动任务。",
      "选择一个已激活批准的任务模板，或先完成该地图包的激活。",
    );
  }
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

  return {
    ok: true,
    taskTemplateId: binding.taskTemplateId,
    activationId: binding.activationId,
    requestedPlatformId: binding.requestedPlatformId,
    selectedMapId: binding.mapId,
  };
};

const resolveExplicitBinding = (input: {
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
}): MissionStartBinding => {
  if (!input.requestedPlatformId || !input.selectedMapId) {
    return createBindingFailure(
      "requestedPlatformId and selectedMapId are both required before mission start.",
      "任务无法启动，因为缺少 taskTemplateId 或显式地图绑定。",
      "选择一个已激活批准的任务模板，或在开发者模式下提供有效的 selectedMapId 与 requestedPlatformId。",
    );
  }

  const record = getDefaultMapPluginRegistry().active.getActiveOperationalMapRecord(input.selectedMapId);
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

  return {
    ok: true,
    taskTemplateId: record.taskTemplateId,
    activationId: record.activationId,
    requestedPlatformId: input.requestedPlatformId,
    selectedMapId: input.selectedMapId,
  };
};

export function normalizeRequestedPlatformId(value?: string): RequestedPlatformId | null {
  return value === "tiktok-web" || value === "facebook-web" ? value : null;
}

export function resolveMissionStartBinding(input: {
  taskTemplateId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
}): MissionStartBinding {
  return input.taskTemplateId
    ? resolveTaskTemplateBinding({
        taskTemplateId: input.taskTemplateId,
        requestedPlatformId: input.requestedPlatformId,
        selectedMapId: input.selectedMapId,
      })
    : resolveExplicitBinding({
        requestedPlatformId: input.requestedPlatformId,
        selectedMapId: input.selectedMapId,
      });
}

export function normalizePositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    return undefined;
  }

  return value;
}import { getDefaultMapPluginRegistry } from "../map-plugins/registry/map-plugin-registry.js";

type ActiveRegistry = ReturnType<typeof getDefaultMapPluginRegistry>["active"];
type TaskTemplateBinding = NonNullable<ReturnType<ActiveRegistry["getTaskTemplateDeveloperBinding"]>>;

export type RequestedPlatformId = "facebook-web" | "tiktok-web";

export type MissionStartBindingInput = {
  taskTemplateId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
};

export type MissionStartBindingSuccess = {
  ok: true;
  taskTemplateId: string;
  activationId: string;
  requestedPlatformId: RequestedPlatformId;
  selectedMapId: string;
};

type MissionStartBindingFailure = {
  ok: false;
  failureReason: string;
  actionableMessage: string;
  nextAction: string;
};

export type MissionStartBindingResult = MissionStartBindingSuccess | MissionStartBindingFailure;

const createBindingFailure = (failureReason: string, actionableMessage: string, nextAction: string): MissionStartBindingFailure => {
  return { ok: false, failureReason, actionableMessage, nextAction };
};

const resolveTemplateBindingConflict = (input: MissionStartBindingInput, binding: TaskTemplateBinding): MissionStartBindingFailure | null => {
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

const resolveTaskTemplateBinding = (activeRegistry: ActiveRegistry, input: MissionStartBindingInput): MissionStartBindingResult => {
  const binding = input.taskTemplateId ? activeRegistry.getTaskTemplateDeveloperBinding(input.taskTemplateId) : null;
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

  return {
    ok: true,
    taskTemplateId: binding.taskTemplateId,
    activationId: binding.activationId,
    requestedPlatformId: binding.requestedPlatformId,
    selectedMapId: binding.mapId,
  };
};

const resolveExplicitBinding = (activeRegistry: ActiveRegistry, input: MissionStartBindingInput): MissionStartBindingResult => {
  if (!input.requestedPlatformId || !input.selectedMapId) {
    return createBindingFailure(
      "requestedPlatformId and selectedMapId are both required before mission start.",
      "任务无法启动，因为缺少 taskTemplateId 或显式地图绑定。",
      "选择一个已激活批准的任务模板，或在开发者模式下提供有效的 selectedMapId 与 requestedPlatformId。",
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

  return {
    ok: true,
    taskTemplateId: record.taskTemplateId,
    activationId: record.activationId,
    requestedPlatformId: input.requestedPlatformId,
    selectedMapId: input.selectedMapId,
  };
};

export function normalizeRequestedPlatformId(value?: string): RequestedPlatformId | null {
  return value === "tiktok-web" || value === "facebook-web" ? value : null;
}

export function normalizePositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    return undefined;
  }

  return value;
}

export function resolveMissionStartBinding(input: MissionStartBindingInput): MissionStartBindingResult {
  const activeRegistry = getDefaultMapPluginRegistry().active;
  return input.taskTemplateId
    ? resolveTaskTemplateBinding(activeRegistry, input)
    : resolveExplicitBinding(activeRegistry, input);
}