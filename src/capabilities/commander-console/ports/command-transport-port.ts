import type { RequestedPlatformId } from "../../orchestration/contract.js";
import type { CommanderCommandType } from "../shared/command-policy.js";

export type CommanderTargetRecordRef = {
  recordType: "candidate" | "evidence-packet" | "browse-ledger" | "failed-record" | "runtime-event" | "mission";
  recordId: string;
};

export type CommanderHumanCommand = {
  commandId: string;
  commandType: CommanderCommandType;
  operatorRef: string;
  createdAt: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  targetRecordRef: CommanderTargetRecordRef | null;
  requestedPlatformId: RequestedPlatformId | null;
  humanGoal: string | null;
  initialPayload: Record<string, unknown>;
  operatorNote: string | null;
};

export type HumanCommandTransportResult = {
  commandId: string;
  envelopeRef: string;
  status: "accepted" | "failed";
  payload: Record<string, unknown>;
  failureReason: string | null;
  debugLogRef: string | null;
};

export interface CommandTransportPort {
  emitHumanCommand(command: CommanderHumanCommand): Promise<HumanCommandTransportResult>;
}