import type { z } from "zod";

import type {
  AiAbilityInput,
  AiCommentSignalSummaryOutput,
  AiEvidencePacketAnalysisOutput,
  AiOcrCleanupOutput,
  AiProductSignalSummaryOutput,
  AiSchemaValidationOnlyOutput,
  AiVisualOutput,
} from "../contract.js";
import { MapAuthoringAiOutputSchema, type MapAuthoringAiOutput } from "../../../map-plugins/authoring/map-authoring-ai-output.schema.js";

function buildVisualFallback(reason: string): AiVisualOutput {
  return {
    inputMode: "single_frame_fallback",
    multiFrameEvidenceSetId: null,
    contactSheetEvidenceId: null,
    frameEvidenceIds: [],
    screenshotEvidenceId: null,
    sampledFrameCount: 1,
    validFrameCount: 0,
    expectedFrameCount: 1,
    fallbackReason: reason,
    missingFrames: [],
    isProductVideo: null,
    confidence: 0,
    visibleProductTypes: [],
    evidenceObservations: [],
    reason,
    frameLevelObservations: [],
    aggregateReason: reason,
    suggestedNextAction: "review_required",
    uncertainty: [reason],
    mustReview: true,
  };
}

function buildFallbackByTaskType(reason: string) {
  return {
    product_presence_judgment: buildVisualFallback(reason),
    visual_observation: buildVisualFallback(reason),
    visual_target_candidate_analysis: buildVisualFallback(reason),
    ocr_cleanup: { cleanedComments: [], uncertainText: [reason], confidence: 0 },
    comment_signal_summary: { purchaseIntent: "low", painPoints: [], complaints: [], demandTerms: [], confidence: 0 },
    product_signal_summary: { category: "unknown", useCase: "unknown", sellingPoints: [], painPoints: [], purchaseIntent: "low", risk: "high", score: 0, rationale: reason },
    evidence_packet_analysis: { packetSummary: reason, evidenceIds: [], notes: [reason] },
    map_authoring: MapAuthoringAiOutputSchema.parse({
      draftPackage: {
        displayName: "Draft Review Required",
        description: reason,
        taskCategory: "draft-review",
        defaultHumanGoal: reason,
        recommended: false,
        safetyLevel: "review-first",
        userVisibleCapabilities: ["Human review required"],
        defaultRunLimit: { maxRounds: 1, maxMinutes: 5 },
        maxAllowedRunLimit: { maxRounds: 1, maxMinutes: 5 },
        humanGoal: reason,
        allowedAbilityGroups: ["forensics-persistence"],
        initialStepId: "finalize-mission",
        steps: [
          {
            stepId: "finalize-mission",
            capabilityId: "orchestration",
            childCapabilityId: "finalize-mission",
            stepKind: "finalize",
            targetAbilityGroupId: null,
            inputRefs: [],
            outputRefPolicy: { storeAs: [] },
            promptContractId: null,
            successCondition: {
              conditionType: "comparison",
              leftRef: "status",
              operator: "equals",
              rightValue: "success",
            },
            failureBranch: "finalize-mission:failed",
            reviewBranch: "finalize-mission:review",
            postActionVerification: null,
            timeoutPolicy: { maxDurationMs: 1000 },
            proofPolicy: { requiresRuntimeProof: true },
          },
        ],
        transitions: [
          {
            transitionId: "finalize-mission:success",
            fromStepId: "finalize-mission",
            onStatus: "success",
            condition: {
              conditionType: "comparison",
              leftRef: "status",
              operator: "equals",
              rightValue: "success",
            },
            toStepId: null,
            finalStatus: "completed",
          },
          {
            transitionId: "finalize-mission:failed",
            fromStepId: "finalize-mission",
            onStatus: "failed",
            condition: {
              conditionType: "comparison",
              leftRef: "status",
              operator: "equals",
              rightValue: "failed",
            },
            toStepId: null,
            finalStatus: "failed",
          },
          {
            transitionId: "finalize-mission:review",
            fromStepId: "finalize-mission",
            onStatus: "review_required",
            condition: {
              conditionType: "comparison",
              leftRef: "status",
              operator: "equals",
              rightValue: "review_required",
            },
            toStepId: null,
            finalStatus: "review_required",
          },
        ],
        failureBranches: ["finalize-mission:failed"],
        reviewBranches: ["finalize-mission:review"],
        finalStates: ["completed", "failed", "review_required"],
        forbiddenDirectCalls: ["PlatformAdapter", "EvidenceStoreService", "direct-ability-call"],
        sequencePolicy: {
          maxHops: 1,
          maxRetriesPerStep: 0,
          loopDecisionOnLimit: "review_required",
          branchPolicy: "allow_review_handoff",
        },
        dependencies: {
          requiredCapabilities: ["forensics-persistence"],
          requiredChildCapabilities: ["finalize-mission"],
          requiredPromptContracts: [],
          requiredPlatformProfiles: [],
          requiredForensicsRecords: [],
        },
        policy: {
          safetyPolicy: "review-first",
          runLimitPolicy: {
            defaultMaxRounds: 1,
            maxAllowedMaxRounds: 1,
            maxAllowedMaxMinutes: 5,
          },
          reviewPolicy: "review-first",
          exportPolicy: "forensics only",
          debugPolicy: "developer-inspect only",
        },
        promptBindings: { bindings: [] },
      },
      humanReadableExplanation: reason,
      confidence: 0,
      requiredClarifications: [reason],
      riskWarnings: [reason],
      validationHints: [reason],
      needsCapabilityExpansion: true,
      draftStatus: "needs_clarification",
    }),
    schema_validation_only: { valid: false, issues: [reason] },
  } as const;
}

export function buildNonAuthoritativeOutput(taskType: AiAbilityInput["taskType"], reason: string): AiVisualOutput | AiOcrCleanupOutput | AiCommentSignalSummaryOutput | AiProductSignalSummaryOutput | AiEvidencePacketAnalysisOutput | MapAuthoringAiOutput | AiSchemaValidationOnlyOutput {
  return buildFallbackByTaskType(reason)[taskType];
}
