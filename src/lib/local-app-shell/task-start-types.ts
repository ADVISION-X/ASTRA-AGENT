import type {
  MissionStartBinding,
  RequestedPlatformId,
  UserRequirementSelectedPlatformId,
} from "./task-start-binding-contract.js";

export type MissionMode = "pure_visual" | "dom_product_video";

export type StartMissionBody = {
  commandSource?: string;
  missionMode?: MissionMode;
  userRequirementText: string;
  selectedPlatforms: UserRequirementSelectedPlatformId[];
  productVideoPageUrl?: string | null;
  maxRounds?: number;
  maxMinutes?: number;
  historyEntryId?: string | null;
  operatorNote?: string | null;
};

export type StartDraft = {
  traceId: string;
  attemptId: string;
  commandSource: string;
  missionMode: MissionMode;
  userRequirementText: string;
  selectedPlatforms: UserRequirementSelectedPlatformId[];
  productVideoPageUrl: string | null;
  historyEntryId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  maxRounds: number | undefined;
  maxMinutes: number | undefined;
  operatorNote: string | null;
};

export type StartApproval = Omit<StartDraft, "maxRounds" | "maxMinutes"> & {
  maxRounds: number;
  maxMinutes: number;
  binding: Extract<MissionStartBinding, { ok: true }>;
};

export type StartCommandResult = {
  status: string;
  output: unknown;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  runtimeProof?: {
    proofId?: string | null;
    runId?: string | null;
    inputRef?: string | null;
    outputRef?: string | null;
    commandEnvelopeRef?: string | null;
    resultEnvelopeRef?: string | null;
  } | null;
};
