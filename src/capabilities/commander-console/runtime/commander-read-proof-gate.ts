import type { CommanderReadChildContract, CommanderTargetRecordRef } from "../contract.js";
import { commanderFlag, type CommanderDataQualityFlag, type CommanderEvidenceRef } from "../shared/commander-proof.js";

type CommanderReadProofGateResult = {
  status: "success" | "review_required";
  reviewRequiredReason: string | null;
  dataQualityFlags: CommanderDataQualityFlag[];
  evidenceRefs: CommanderEvidenceRef[];
  targetRecordRef: CommanderTargetRecordRef | null;
  missionId: string | null;
};

function createReviewRequired(input: {
  reason: string;
  dataQualityFlags: CommanderDataQualityFlag[];
  evidenceRefs: CommanderEvidenceRef[];
  targetRecordRef: CommanderTargetRecordRef | null;
  missionId: string | null;
}): CommanderReadProofGateResult {
  return {
    status: "review_required",
    reviewRequiredReason: input.reason,
    dataQualityFlags: [...input.dataQualityFlags, commanderFlag("read_proof_guarded", "warn", input.reason)],
    evidenceRefs: input.evidenceRefs,
    targetRecordRef: input.targetRecordRef,
    missionId: input.missionId,
  };
}

type CommanderReadProofGateInput = {
  contract: CommanderReadChildContract;
  evidenceRefs: CommanderEvidenceRef[];
  dataQualityFlags: CommanderDataQualityFlag[];
  targetRecordRef: CommanderTargetRecordRef | null;
  missionId: string | null;
};

const getMissingReadModelSourceReason = (input: CommanderReadProofGateInput) => {
  return input.contract.readModelSource
    ? null
    : `${input.contract.childCapabilityId} requires readModelSource for governed read proof.`;
};

const getMissingEvidenceRefsReason = (input: CommanderReadProofGateInput) => {
  return input.contract.proofPolicy.requiresStructuredEvidenceRefs && input.evidenceRefs.length === 0
    ? `${input.contract.childCapabilityId} requires structured evidenceRefs from governed read sources.`
    : null;
};

const getMissingTargetRecordReason = (input: CommanderReadProofGateInput) => {
  return input.contract.evidencePolicy.targetRecordRequired && !input.targetRecordRef
    ? `${input.contract.childCapabilityId} requires targetRecordRef for governed read proof.`
    : null;
};

const getMissingProofRefReason = (input: CommanderReadProofGateInput) => {
  return input.contract.evidencePolicy.proofRefRequired && input.evidenceRefs.some((evidenceRef) => !evidenceRef.proofRef)
    ? `${input.contract.childCapabilityId} requires proofRef on every evidenceRef.`
    : null;
};

const getInvalidRecordTypeReason = (input: CommanderReadProofGateInput) => {
  return input.evidenceRefs.some((evidenceRef) => !input.contract.evidencePolicy.recordTypes.includes(evidenceRef.recordType))
    ? `${input.contract.childCapabilityId} returned evidenceRefs outside its governed recordTypes.`
    : null;
};

const getReadProofGateReason = (input: CommanderReadProofGateInput) => {
  return getMissingReadModelSourceReason(input)
    ?? getMissingEvidenceRefsReason(input)
    ?? getMissingTargetRecordReason(input)
    ?? getMissingProofRefReason(input)
    ?? getInvalidRecordTypeReason(input);
};

export function applyCommanderReadProofGate(input: {
  contract: CommanderReadChildContract;
  evidenceRefs: CommanderEvidenceRef[];
  dataQualityFlags: CommanderDataQualityFlag[];
  targetRecordRef: CommanderTargetRecordRef | null;
  missionId: string | null;
}): CommanderReadProofGateResult {
  const reason = getReadProofGateReason(input);
  if (reason) {
    return createReviewRequired({
      reason,
      dataQualityFlags: input.dataQualityFlags,
      evidenceRefs: input.evidenceRefs,
      targetRecordRef: input.targetRecordRef,
      missionId: input.missionId,
    });
  }

  return {
    status: "success",
    reviewRequiredReason: null,
    dataQualityFlags: input.dataQualityFlags,
    evidenceRefs: input.evidenceRefs,
    targetRecordRef: input.targetRecordRef,
    missionId: input.missionId,
  };
}