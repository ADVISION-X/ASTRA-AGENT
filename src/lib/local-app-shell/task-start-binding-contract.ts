export type RequestedPlatformId =
  | "facebook-web"
  | "tiktok-web"
  | "macos-local"
  | "iphone-mirroring-facebook-app"
  | "iphone-mirroring-tiktok-app";

export type UserRequirementSelectedPlatformId = Extract<RequestedPlatformId, "facebook-web" | "tiktok-web">;

export type MissionStartBindingFailure = {
  ok: false;
  failureReason: string;
  actionableMessage: string;
  nextAction: string;
};

export type MissionStartBindingSuccess = {
  ok: true;
  requestedPlatformId: RequestedPlatformId;
  targetProfileRef: string;
  targetUrl: string;
  targetTitle: string;
  userRequirementRef: string;
  selectedMapId: string;
  taskTemplateId: string;
  activationSnapshotRef: string;
};

export type MissionStartBinding = MissionStartBindingFailure | MissionStartBindingSuccess;

export const createBindingFailure = (failureReason: string, actionableMessage: string, nextAction: string): MissionStartBindingFailure => {
  return { ok: false, failureReason, actionableMessage, nextAction };
};