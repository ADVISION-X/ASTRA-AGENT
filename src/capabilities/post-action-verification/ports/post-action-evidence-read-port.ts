import type { ParsedPostActionVerificationAbilityInput, PostActionEvidenceRef, PostActionObservation } from "../contract.js";

export type PostActionEvidenceReadPort = {
  listObservations(request: ParsedPostActionVerificationAbilityInput): PostActionObservation[];
  getObservationByRef(request: ParsedPostActionVerificationAbilityInput, ref: string): PostActionObservation | null;
  getEvidenceByRef(request: ParsedPostActionVerificationAbilityInput, ref: string): PostActionEvidenceRef | null;
  getActionLogByRef(request: ParsedPostActionVerificationAbilityInput, ref: string): {
    actionLogRef: string;
    sourceRuntimeProofRef: string;
    sourceActionResultRef: string | null;
    sourceActionOutputRef: string | null;
  } | null;
  verifyProofRef(request: ParsedPostActionVerificationAbilityInput, ref: string): boolean;
  verifyEvidenceBinding(request: ParsedPostActionVerificationAbilityInput, evidenceRef: string): boolean;
};
