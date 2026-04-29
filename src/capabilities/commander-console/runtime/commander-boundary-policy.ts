import type { CommanderHumanCommandInput, CommanderTargetRecordRef } from "../contract.js";
import type { CommanderEvidencePolicy } from "../shared/commander-command-policy.js";
import { commanderFlag, type CommanderDataQualityFlag, type CommanderEvidenceRef } from "../shared/commander-proof.js";

export function buildCommanderEvidenceRef(input: {
  recordType: CommanderEvidenceRef["recordType"];
  recordId: string;
  sourceAbility: CommanderEvidenceRef["sourceAbility"];
  proofRef?: string | null;
}): CommanderEvidenceRef {
  return {
    recordRef: {
      recordType: input.recordType,
      recordId: input.recordId,
    },
    sourceAbility: input.sourceAbility,
    recordType: input.recordType,
    proofRef: input.proofRef ?? null,
  };
}

export function deriveCommandTargetRecordRef(command: CommanderHumanCommandInput): CommanderTargetRecordRef | null {
  if (command.targetRecordRef) {
    return command.targetRecordRef;
  }
  if (command.targetMissionId) {
    return {
      recordType: "mission",
      recordId: command.targetMissionId,
    };
  }
  return null;
}

export function deriveCommandEvidenceRefs(
  command: CommanderHumanCommandInput,
  evidencePolicy: CommanderEvidencePolicy,
): CommanderEvidenceRef[] {
  const targetRecordRef = deriveCommandTargetRecordRef(command);
  if (!targetRecordRef) {
    return [];
  }
  if (!evidencePolicy.recordTypes.includes(targetRecordRef.recordType)) {
    return [];
  }
  return [
    buildCommanderEvidenceRef({
      recordType: targetRecordRef.recordType,
      recordId: targetRecordRef.recordId,
      sourceAbility: evidencePolicy.sourceAbility,
      proofRef: null,
    }),
  ];
}

export function missingEnvelopeFlag(): CommanderDataQualityFlag {
  return commanderFlag("transport_missing_envelope", "fatal", "Transport did not return an envelopeRef.");
}