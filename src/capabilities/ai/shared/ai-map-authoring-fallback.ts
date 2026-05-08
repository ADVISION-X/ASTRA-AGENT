import type { z } from "zod";

import { MapAuthoringAiOutputSchema } from "./ai-map-authoring-schemas.js";

const MAP_AUTHORING_REVIEW_DRAFT_TEMPLATE = {
  draftPackage: {
    displayName: "Draft Review Required",
    description: "",
    taskCategory: "draft-review",
    defaultHumanGoal: "",
    recommended: false,
    safetyLevel: "review-first",
    userVisibleCapabilities: ["Human review required"],
    humanGoal: "",
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
        timeoutPolicy: { maxDurationMs: 60_000 },
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
      reviewPolicy: "review-first",
      exportPolicy: "forensics only",
      debugPolicy: "developer-inspect only",
    },
    promptBindings: { bindings: [] },
  },
  humanReadableExplanation: "",
  confidence: 0,
  requiredClarifications: [] as string[],
  riskWarnings: [] as string[],
  validationHints: [] as string[],
  needsCapabilityExpansion: true,
  draftStatus: "needs_clarification" as const,
};

export type MapAuthoringFallbackOutput = z.output<typeof MapAuthoringAiOutputSchema>;

export function buildMapAuthoringFallback(reason: string): MapAuthoringFallbackOutput {
  return MapAuthoringAiOutputSchema.parse({
    ...MAP_AUTHORING_REVIEW_DRAFT_TEMPLATE,
    draftPackage: {
      ...MAP_AUTHORING_REVIEW_DRAFT_TEMPLATE.draftPackage,
      description: reason,
      defaultHumanGoal: reason,
      humanGoal: reason,
    },
    humanReadableExplanation: reason,
    requiredClarifications: [reason],
    riskWarnings: [reason],
    validationHints: [reason],
  });
}