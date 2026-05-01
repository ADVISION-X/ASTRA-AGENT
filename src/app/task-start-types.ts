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

export type MissionStartBindingFailure = {
  ok: false;
  failureReason: string;
  actionableMessage: string;
  nextAction: string;
};

export type MissionStartBindingResult = MissionStartBindingSuccess | MissionStartBindingFailure;