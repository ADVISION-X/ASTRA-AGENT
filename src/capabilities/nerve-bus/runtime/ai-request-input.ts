import type { AiRequestEnvelope, NerveBusPayloadDocument } from "../index.js";
import { AiVisionRequestInputSchema } from "../../ai/schema-core.schema.js";
import { payloadDocumentToObject } from "../../../lib/local-runtime/workbench-payload.js";

export const buildAiAbilityRequest = (
  envelope: AiRequestEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const input = AiVisionRequestInputSchema.parse(payloadDocumentToObject(inputPayload));
  return {
    abilityGroupId: "ai" as const,
    missionId: envelope.missionId,
    taskType: "product_presence_judgment" as const,
    inputModality: "image_collection" as const,
    inputRefs: [],
    promptContractId: "vision.productPresence.v1",
    expectedOutputSchema: "ai.product_presence_judgment.v1",
    requestedBy: "orchestration" as const,
    transportedBy: "nerve-bus" as const,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    qualityPolicy: { minimumConfidence: 0.6, requireSchemaValidation: true },
    providerPolicy: { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["local-vision-ai"], operatorApprovalRef: null },
    costPolicy: { maxEstimatedCost: 0 },
    dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
    safetyPolicy: { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true },
    input,
  };
};