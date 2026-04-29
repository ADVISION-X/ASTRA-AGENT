import type { EvidenceRef } from "../../types/evidence.js";

import type { AiRuntimeProof } from "./shared/ai-runtime-proof.js";

export const AI_ABILITY_GROUP_ID = "ai";
export const AI_CHILD_CAPABILITY_IDS = [
  "local-vision-ai",
  "local-text-ai",
  "local-ocr-ai",
  "internal-schema-validator",
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

export type AiAbilityGroupId = typeof AI_ABILITY_GROUP_ID;
export type AiTaskType =
  | "product_presence_judgment"
  | "visual_observation"
  | "visual_target_candidate_analysis"
  | "ocr_cleanup"
  | "comment_signal_summary"
  | "product_signal_summary"
  | "evidence_packet_analysis"
  | "schema_validation_only";
export type AiChildCapabilityId = (typeof AI_CHILD_CAPABILITY_IDS)[number];
export type AiProviderKind = "local" | "paid" | "future" | "internal";
export type AiChildCapabilityStatus = "ready" | "degraded" | "unavailable" | "disabled_by_policy";
export type AiInputModality = "image_collection" | "text_blocks" | "structured_record" | "mixed" | "none";
export type AiRequestedBy = "orchestration";
export type AiTransportedBy = "nerve-bus";
export type AiModelRole = "vision" | "ocr" | "commentUnderstanding" | "productSignal" | "schemaValidator" | "multi-role" | "future";
export type AiSchemaValidationStatus = "valid" | "invalid" | "not_applicable";
export type AiExecutionStatus = "success" | "failed" | "review_required";

export type AiProviderPolicy = {
  requireLocalOnly: boolean;
  allowPaidProvider: boolean;
  providerAllowlist: AiChildCapabilityId[];
  operatorApprovalRef: string | null;
};

export type AiCostPolicy = {
  maxEstimatedCost: number | null;
};

export type AiDataPolicy = {
  allowExternalTransmission: boolean;
  redactSensitiveData: boolean;
};

export type AiQualityPolicy = {
  minimumConfidence: number | null;
  requireSchemaValidation: boolean;
};

export type AiSafetyPolicy = {
  reviewOnLowConfidence: boolean;
  reviewOnSchemaFailure: boolean;
  reviewOnPolicyViolation: boolean;
};

export type AiPromptContract = {
  taskType: AiTaskType;
  modelRole: AiModelRole;
  promptId: string;
  promptVersion: string;
  schemaVersion: string;
  purpose: string;
  forbiddenOutputs: string[];
};

export type AiExecutionOptions = {
  debugHook?: (event: AiDebugEvent) => Promise<void> | void;
};

export type AiDebugEvent = {
  eventType: string;
  detail: string;
  durationMs?: number;
};

export type AiRuntimeHealth = {
  overallStatus: "ready" | "degraded" | "unavailable";
  implementationStatus: string;
  dependencies: {
    gateway: string;
    vision: string;
    text: string;
    ocr: string;
  };
  configuredModels: {
    vision: string;
    commentUnderstanding: string;
    ocr: string;
    productSignal: string;
  };
  availableModels: string[];
  lastCheckedAt: string;
  failureReason: string | null;
  lastTaskType: AiTaskType | null;
  lastFailureReason: string | null;
  lastInvocationStatus: string | null;
};

export type AiAbilityInput = {
  abilityGroupId: AiAbilityGroupId;
  taskType: AiTaskType;
  inputModality: AiInputModality;
  inputRefs: EvidenceRef[];
  promptContractId: string;
  expectedOutputSchema: string;
  requestedBy: AiRequestedBy;
  transportedBy: AiTransportedBy;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  qualityPolicy: AiQualityPolicy;
  providerPolicy: AiProviderPolicy;
  costPolicy: AiCostPolicy;
  dataPolicy: AiDataPolicy;
  safetyPolicy: AiSafetyPolicy;
  input: unknown;
};

export type AiAbilityResult = {
  status: AiExecutionStatus;
  abilityGroupId: AiAbilityGroupId;
  childCapabilityId: AiChildCapabilityId;
  taskType: AiTaskType;
  modelProvider: AiProviderKind;
  modelName: string;
  modelRole: AiModelRole;
  runtime: string;
  implementationStatus: string;
  output: unknown;
  rawOutputRef: string | null;
  schemaValidationStatus: AiSchemaValidationStatus;
  confidence: number | null;
  failureReason: string | null;
  durationMs: number;
  costEstimate: number | null;
  evidenceRefs: EvidenceRef[];
  debugLogRef: string | null;
  runtimeProof: AiRuntimeProof;
  promptVersion: string;
  schemaVersion: string;
  createdAt: string;
};

export type AiChildCapabilityCheckResult = {
  abilityGroupId: AiAbilityGroupId;
  childCapabilityId: AiChildCapabilityId;
  providerKind: AiProviderKind;
  status: AiChildCapabilityStatus;
  supportedTaskTypes: AiTaskType[];
  detail: string;
  enabledByPolicy: boolean;
};

export type AiHealthReport = {
  ok: boolean;
  detail: string;
  health: AiRuntimeHealth;
  childStatuses: AiChildCapabilityCheckResult[];
};

export type AiModelRosterEntry = {
  childCapabilityId: AiChildCapabilityId;
  providerKind: AiProviderKind;
  taskTypes: AiTaskType[];
  modelRole: AiModelRole;
  runtime: string;
  modelOrTool: string | null;
  enabledByPolicy: boolean;
  status: "configured" | "placeholder" | "disabled_by_policy";
};

export type AiModelRoster = {
  generatedAt: string;
  entries: AiModelRosterEntry[];
};

export interface AiRuntimeBridge {
  execute(input: AiAbilityInput, options?: AiExecutionOptions): Promise<AiAbilityResult>;
  getHealth(): Promise<{ ok: boolean; detail: string; health: AiRuntimeHealth }>;
  getRuntimeHealth(): Promise<AiRuntimeHealth>;
  resolvePromptContract(taskType: AiTaskType): AiPromptContract;
  getModelRoster(): Promise<AiModelRoster>;
}

export type AiCapabilityContext = {
  runtime: AiRuntimeBridge;
};

export interface AiChildCapability {
  readonly abilityGroupId: AiAbilityGroupId;
  readonly childCapabilityId: AiChildCapabilityId;
  readonly providerKind: AiProviderKind;
  readonly purpose: string;
  readonly supportedTaskTypes: readonly AiTaskType[];

  canHandle(taskType: AiTaskType): boolean;
  checkReadiness(context: AiCapabilityContext): Promise<AiChildCapabilityCheckResult>;
  execute(
    input: AiAbilityInput,
    context: AiCapabilityContext,
    options?: AiExecutionOptions,
  ): Promise<AiAbilityResult>;
}

export interface AiAbilityGroup {
  listChildCapabilityIds(): AiChildCapabilityId[];
  routeTask(taskType: AiTaskType): AiChildCapabilityId;
  execute(input: AiAbilityInput, options?: AiExecutionOptions): Promise<AiAbilityResult>;
  getHealth(): Promise<AiHealthReport>;
  getRuntimeHealth(): Promise<AiRuntimeHealth>;
  getPromptContract(taskType: AiTaskType): AiPromptContract;
  getModelRoster(): Promise<AiModelRoster>;
}