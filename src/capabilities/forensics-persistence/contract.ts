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
type ForensicsAppendRecordRequest = Omit<ForensicsAppendRecordInput, "childCapabilityId" | "capabilityCallId"> & {
  correlationId?: string;
};
type ForensicsAppendArtifactRequest = Omit<ForensicsAppendArtifactInput, "childCapabilityId">;

interface ForensicsPersistenceAbilityGroup {
  readonly abilityGroupId: ForensicsPersistenceAbilityGroupId;
  execute(input: ForensicsAbilityInput): Promise<ForensicsPersistenceAbilityResult>;
  appendRecord(input: ForensicsAppendRecordRequest): Promise<ForensicsPersistenceAbilityResult>;
  appendArtifact(input: ForensicsAppendArtifactRequest): Promise<ForensicsPersistenceAbilityResult>;
  readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsPersistenceAbilityResult>;
}

export type { ForensicsPersistenceAbilityGroup };
