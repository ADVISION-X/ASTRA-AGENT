import type { MissionStartBinding, RequestedPlatformId } from "./task-start-binding.js";

export type StartTaskBody = {
  commandSource?: string;
  humanGoal?: string;
  taskTemplateId?: string;
  requestedPlatformId?: string;
  selectedMapId?: string;
  maxRounds?: number;
  maxMinutes?: number;
  operatorNote?: string;
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
  operatorNote: string | null;
};

export type StartApproval = StartDraft & {
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
