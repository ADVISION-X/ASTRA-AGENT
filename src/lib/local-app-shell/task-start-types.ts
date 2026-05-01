import type { MissionStartBinding, RequestedPlatformId } from "./task-start-binding.js";

export type StartTaskBody = {
  commandSource?: string;
  humanGoal?: string;
  taskTemplateId?: string;
  requestedPlatformId?: string;
  selectedMapId?: string;
  maxRounds?: number;
  maxMinutes?: number;
};

export type StartDraft = {
  traceId: string;
  attemptId: string;
  commandSource: string;
  humanGoal: string | null;
  taskTemplateId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
  maxRounds: number | undefined;
  maxMinutes: number | undefined;
};

export type StartApproval = StartDraft & {
  binding: Extract<MissionStartBinding, { ok: true }>;
};

export type StartCommandResult = {
  status: string;
  output: unknown;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
};