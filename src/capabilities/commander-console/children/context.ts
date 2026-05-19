import type { CommandTransportPort } from "../envelope.js";

export type CommanderChildContext = {
  commandTransport: CommandTransportPort;
  getMissionStatus: () => CommanderMissionStatusSnapshot;
};

export type CommanderMissionStatusSnapshot = {
  missionId: string | null;
  status: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "unknown";
  currentPlatform: string | null;
  userRequirementSummary: string | null;
  startedAt: string | null;
  updatedAt: string;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  matchedEvidenceCount: number;
  lastActionFailureCount: number;
};
