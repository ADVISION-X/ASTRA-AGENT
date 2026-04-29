import { createId } from "../../../lib/local-runtime/ids.js";

import type { CommanderHumanCommandInput } from "../contract.js";
import { HumanCommandInputSchema } from "../schema.js";
import { COMMAND_CHILD_TO_TYPE, COMMAND_TYPE_TO_PRIORITY, isEmergencyStopChild } from "../shared/commander-command-policy.js";
import type { CommanderCommandPriority } from "../shared/commander-proof.js";

export type CommanderTransportPayload = {
  requestedBy: "commander-console";
  requestedPlatformId?: "facebook-web" | "tiktok-web";
  selectedMapId?: string;
  humanGoal?: string;
  operatorNote?: string;
  candidateId?: string;
  decision?: "approve" | "reject" | "mark-review-required";
};

export type GatedCommanderCommand = {
  commandId: string;
  commandType: CommanderHumanCommandInput["commandType"];
  priority: CommanderCommandPriority;
  operatorRef: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  requestedPlatformId: "facebook-web" | "tiktok-web" | null;
  humanGoal: string | null;
  targetRecordRef: { recordType: "candidate" | "evidence-packet" | "browse-ledger" | "failed-record" | "runtime-event" | "mission"; recordId: string } | null;
  operatorNote: string | null;
  payload: CommanderTransportPayload;
};

const DEFAULT_HUMAN_GOAL = "Discover evidence-backed product opportunities from the active social feed.";

export function gateCommanderCommand(input: {
  childCapabilityId: string;
  operatorRef: string;
  commandInput: CommanderHumanCommandInput;
}): { ok: true; command: GatedCommanderCommand; inputRef: string } | { ok: false; reason: string } {
  const commandInput = HumanCommandInputSchema.parse(input.commandInput);
  const inputRef = createId("commander_command_input");

  if (!input.operatorRef.trim()) {
    return { ok: false, reason: "operatorRef is required." };
  }

  if (input.childCapabilityId !== "issue-human-command") {
    const expectedCommandType = COMMAND_CHILD_TO_TYPE[input.childCapabilityId as keyof typeof COMMAND_CHILD_TO_TYPE];
    if (!expectedCommandType || commandInput.commandType !== expectedCommandType) {
      return { ok: false, reason: `Child ${input.childCapabilityId} must emit its owned command type.` };
    }
  }

  if (commandInput.commandType === "start-mission" && !commandInput.requestedPlatformId && !commandInput.selectedMapId) {
    return { ok: false, reason: "start-mission requires requestedPlatformId or selectedMapId." };
  }

  if (["approve-candidate", "reject-candidate", "mark-review-required"].includes(commandInput.commandType) && !commandInput.targetRecordRef?.recordId) {
    return { ok: false, reason: "review commands require a target candidate record." };
  }

  if (isEmergencyStopChild(input.childCapabilityId) && commandInput.commandType !== "emergency-stop") {
    return { ok: false, reason: "emergency-stop child cannot be downgraded." };
  }

  const payload: CommanderTransportPayload = {
    requestedBy: "commander-console",
    ...(commandInput.requestedPlatformId ? { requestedPlatformId: commandInput.requestedPlatformId } : {}),
    ...(commandInput.selectedMapId ? { selectedMapId: commandInput.selectedMapId } : {}),
    ...(commandInput.humanGoal ? { humanGoal: commandInput.humanGoal } : {}),
    ...(commandInput.operatorNote ? { operatorNote: commandInput.operatorNote } : {}),
    ...(commandInput.targetRecordRef?.recordType === "candidate" ? { candidateId: commandInput.targetRecordRef.recordId } : {}),
    ...(commandInput.commandType === "approve-candidate" ? { decision: "approve" as const } : {}),
    ...(commandInput.commandType === "reject-candidate" ? { decision: "reject" as const } : {}),
    ...(commandInput.commandType === "mark-review-required" ? { decision: "mark-review-required" as const } : {}),
  };

  return {
    ok: true,
    inputRef,
    command: {
      commandId: createId("commander_command"),
      commandType: commandInput.commandType,
      priority: COMMAND_TYPE_TO_PRIORITY[commandInput.commandType],
      operatorRef: input.operatorRef,
      targetMissionId: commandInput.targetMissionId ?? null,
      selectedMapId: commandInput.selectedMapId ?? null,
      requestedPlatformId: commandInput.requestedPlatformId ?? null,
      humanGoal: commandInput.commandType === "start-mission"
        ? (commandInput.humanGoal?.trim() || DEFAULT_HUMAN_GOAL)
        : (commandInput.humanGoal ?? null),
      targetRecordRef: commandInput.targetRecordRef ?? null,
      operatorNote: commandInput.operatorNote ?? null,
      payload,
    },
  };
}