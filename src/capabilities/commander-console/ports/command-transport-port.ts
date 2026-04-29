import type { CommanderCommandType, CommanderTargetRecordRef } from "../contract.js";
import type { CommanderCommandPriority } from "../shared/commander-proof.js";

export type CommanderHumanCommand = {
  commandId: string;
  commandType: CommanderCommandType;
  priority: CommanderCommandPriority;
  operatorRef: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  targetRecordRef: CommanderTargetRecordRef | null;
  requestedPlatformId: "facebook-web" | "tiktok-web" | null;
  humanGoal: string | null;
  operatorNote: string | null;
  payload: {
    requestedBy: "commander-console";
    requestedPlatformId?: "facebook-web" | "tiktok-web";
    selectedMapId?: string;
    humanGoal?: string;
    operatorNote?: string;
    candidateId?: string;
    decision?: "approve" | "reject" | "mark-review-required";
  };
};

export type HumanCommandTransportResult = {
  commandId: string;
  envelopeRef: string;
  resultEnvelopeRef: string | null;
  status: "accepted" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  message: string;
  debugLogRef: string | null;
};

export interface CommandTransportPort {
  emitHumanCommand(command: CommanderHumanCommand): Promise<HumanCommandTransportResult>;
}