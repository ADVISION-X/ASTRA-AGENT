export type RequestedPlatformId =
  | "facebook-web"
  | "tiktok-web"
  | "macos-local"
  | "iphone-mirroring-facebook-app"
  | "iphone-mirroring-tiktok-app";

export type UserRequirementSelectedPlatformId = Extract<RequestedPlatformId, "facebook-web" | "tiktok-web">;

export type MissionStartBindingInput = {
  taskTemplateId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
};

export type MissionStartBindingFailure = {
  ok: false;
  failureReason: string;
  actionableMessage: string;
  nextAction: string;
};

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

export type MissionStartBindingSuccess = {
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

export const createBindingFailure = (failureReason: string, actionableMessage: string, nextAction: string): MissionStartBindingFailure => {
  return { ok: false, failureReason, actionableMessage, nextAction };
};

export const resolveMissingTargetDefaults = (selectedMapId: string, targetProfileRef: string): MissionStartBindingFailure => (
  createBindingFailure(
    `selectedMapId=${selectedMapId} targetProfileRef=${targetProfileRef} cannot resolve governed target defaults before mission start.`,
    "任务无法启动，因为激活地图的 targetProfileRef 不能解析出受治理 targetUrl/targetTitle；禁止把目标字段留空后再进入运行时。",
    "修复该地图绑定的 Open target profile，使 start-mission 在派发前拿到显式 targetUrl 和 targetTitle。",
  )
);