import type { ParsedPostActionVerificationAbilityInput, PostActionObservation } from "../contract.js";

export type PostActionEvidenceReadPort = {
  listObservations(request: ParsedPostActionVerificationAbilityInput): PostActionObservation[];
  getObservationByRef(request: ParsedPostActionVerificationAbilityInput, ref: string): PostActionObservation | null;
};
