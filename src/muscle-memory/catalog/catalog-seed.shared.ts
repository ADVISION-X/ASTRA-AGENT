import type { MuscleMemoryInputContract } from "./muscle-memory-catalog.schema.js";

export type AtomicSeed = {
  actionCode: string;
  displayName: string;
  description: string;
  abilityGroupId: string;
  childCapabilityId: string;
  allowedForAiActionPlan: boolean;
  allowedForUserRequirement: boolean;
  requiresGridSpecRef: boolean;
  requiresScreenshotRef: boolean;
  requiresPageStateRef: boolean;
  requiresGeometryProof: boolean;
  requiresPostActionVerification: boolean;
  sensitiveOperation: boolean;
  inputContract: MuscleMemoryInputContract;
  successOutputRefs: string[];
  failurePolicy: "continue" | "stop" | "review_required";
};

export const emptyContract = (): MuscleMemoryInputContract => ({
  requiredFields: [],
  optionalFields: [],
  forbiddenFields: ["abilityGroupId", "childCapabilityId"],
});

export const keyContract = (key: string): MuscleMemoryInputContract => ({
  requiredFields: [key],
  optionalFields: ["pageStateRef", "screenshotEvidenceRef"],
  forbiddenFields: ["abilityGroupId", "childCapabilityId"],
});

export const FORBIDDEN_RAW_COORDINATES = ["x", "y", "clientX", "clientY", "abilityGroupId", "childCapabilityId"];