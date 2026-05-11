import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID } from "./schema.js";
import type {
  ForensicsAbilityInput,
  ForensicsAppendArtifactInput,
  ForensicsAppendRecordInput,
  ForensicsReadRecordRefInput,
  ForensicsResult,
} from "./schema.js";

type ForensicsPersistenceAbilityGroupId = typeof FORENSICS_PERSISTENCE_ABILITY_GROUP_ID;
type ForensicsPersistenceAbilityResult = ForensicsResult;

interface ForensicsPersistenceAbilityGroup {
  readonly abilityGroupId: ForensicsPersistenceAbilityGroupId;
  execute(input: ForensicsAbilityInput): Promise<ForensicsPersistenceAbilityResult>;
  appendRecord(input: ForensicsAppendRecordInput): Promise<ForensicsPersistenceAbilityResult>;
  appendArtifact(input: ForensicsAppendArtifactInput): Promise<ForensicsPersistenceAbilityResult>;
  readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsPersistenceAbilityResult>;
}

export { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID };

export type {
  ForensicsPersistenceAbilityGroupId,
  ForensicsPersistenceAbilityResult,
  ForensicsPersistenceAbilityGroup,
};
