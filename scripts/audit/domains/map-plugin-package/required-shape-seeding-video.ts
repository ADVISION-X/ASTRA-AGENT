import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { findRoutePlanById } from "../../../../src/map-plugins/route-plans/index.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

type BuiltinPackageRecord = Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number];

const buildFrameSpecificMapTokens = (): string[] =>
  ["3s", "6s", "10s"].flatMap((framePoint) => [
    `capture-video-frame-${framePoint}`,
    `prepare-ai-input-frame-${framePoint}`,
  ]).concat(
    ["Frame3s", "Frame6s", "Frame10s"].flatMap((frameRef) => [
      `screenshotEvidenceRef${frameRef}`,
      `promptInputRef${frameRef}`,
    ]),
  );

const createPromptContractFinding = (record: BuiltinPackageRecord, message: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT,
    file: record.file,
    line: 1,
    severity: "fatal",
    message,
  });

export const inspectSeedingVideoAiInputChain = (record: BuiltinPackageRecord): Finding[] => {
  const requestedPlatformId = record.mapPackage?.taskTemplate.requestedPlatformId ?? null;
  if (!record.mapPackage || requestedPlatformId === null || !["facebook-web", "tiktok-web"].includes(requestedPlatformId) || !record.mapPackage.manifest.packageId.includes("seeding-video-discovery")) {
    return [];
  }

  const routePlan = findRoutePlanById(record.mapPackage.operationalMap.routePlanId);
  const steps = routePlan ? [...record.mapPackage.operationalMap.steps, ...routePlan.steps] : record.mapPackage.operationalMap.steps;
  const mapStepIds = new Set(record.mapPackage.operationalMap.steps.map((step) => step.stepId));
  const routePlanOwnedStepIds = new Set((routePlan?.steps ?? []).map((step) => step.stepId));
  const routePlanTransitionIds = new Set((routePlan?.transitions ?? []).map((transition) => transition.transitionId));
  const capture = steps.find((step) => step.stepId === "capture-video-viewport");
  const prepare = steps.find((step) => step.stepId === "prepare-ai-input");
  const startupPreparation = steps.find((step) => step.stepId === "startup-preparation");
  const judge = steps.find((step) => step.stepId === "judge-seeding-video");
  const analyzeNext = steps.find((step) => step.stepId === "analyze-next-item-target-candidate");
  const locateNext = steps.find((step) => step.stepId === "locate-next-item-target");
  const normalizeNext = steps.find((step) => step.stepId === "normalize-next-video-arrow");
  const clickNext = steps.find((step) => step.stepId === "click-next-video-arrow");
  const verifyNext = steps.find((step) => step.stepId === "verify-next-item-advanced");
  const promptBinding = record.mapPackage.promptBindings.bindings.find((binding) => binding.stepId === "judge-seeding-video");
  const transitions = routePlan ? [...record.mapPackage.operationalMap.transitions, ...routePlan.transitions] : record.mapPackage.operationalMap.transitions;
  const mapTransitions = record.mapPackage.operationalMap.transitions;
  const routePlanTransitions = routePlan?.transitions ?? [];
  const judgeTransitions = transitions.filter((transition) => transition.fromStepId === "judge-seeding-video");
  const dependencies = record.mapPackage.dependencies;
  const requiredCapabilities = dependencies?.requiredCapabilities ?? [];
  const requiredChildCapabilities = dependencies?.requiredChildCapabilities ?? [];
  const hasForbiddenHumanReviewHandoff =
    steps.some((step) => step.stepId === "request-human-review" || step.childCapabilityId === "request-human-review")
    || transitions.some((transition) =>
      transition.fromStepId === "request-human-review"
      || transition.toStepId === "request-human-review",
    )
    || requiredChildCapabilities.includes("request-human-review");
  const hasForbiddenVideoChangePav =
    steps.some((step) => step.stepId.includes("verify-video-changed") || step.childCapabilityId === "verify-video-changed-after-scroll")
    || transitions.some((transition) =>
      transition.transitionId.includes("verify-video-changed")
      || transition.fromStepId.includes("verify-video-changed")
      || (transition.toStepId ?? "").includes("verify-video-changed"),
    )
    || requiredChildCapabilities.includes("verify-video-changed-after-scroll");
  const duplicatesRoutePlanOwnedSteps = [...routePlanOwnedStepIds].some((stepId) => mapStepIds.has(stepId));
  const duplicatesRoutePlanOwnedTransitions = mapTransitions.some((transition) =>
    routePlanTransitionIds.has(transition.transitionId)
  );
  const mapOwnsAiSuccessRouting = mapTransitions.some((transition) =>
    transition.fromStepId === "judge-seeding-video"
    && transition.onStatus === "success"
  );
  const judgeLeaksNextTargetCandidate = judge?.outputRefPolicy.storeAs.includes("aiTargetCandidateRef") === true
    || judge?.outputRefPolicy.storeAs.includes("nextItemTargetCandidateRef") === true
    || promptBinding?.outputSchemaRef === "ai.visual_target_candidate_analysis.v1";
  const routePlanOwnsProductYesNoRouting = routePlanTransitions.some((transition) =>
    transition.transitionId === "judge-seeding-video:read-comments-and-save-evidence"
    && transition.onStatus === "success"
    && transition.toStepId === "observe-comments-button"
  ) && routePlanTransitions.some((transition) =>
    transition.transitionId === "judge-seeding-video:skip-current-video"
    && transition.onStatus === "success"
    && transition.toStepId === "observe-next-item-page-state"
  );
  const hasForbiddenUncertainBranch = judgeTransitions.some((transition) =>
    transition.transitionId.includes("uncertain")
    || transition.toStepId === "request-human-review"
  );
  const usesLegacyNextVideoScrollPath =
    requiredCapabilities.includes("mouse-scroll")
    || requiredChildCapabilities.includes("observe-next-video-region")
    || requiredChildCapabilities.includes("scroll-browser-viewport");
  const hasForbiddenMapSamplingInternals = buildFrameSpecificMapTokens().some((token) => record.text.includes(token));
  const hasAutomaticNonProductClickPath =
    record.mapPackage.operationalMap.routePlanId === "product-discovery-route-plan.v1"
    && record.mapPackage.operationalMap.mapKind === "routePlanBoundMap"
    && routePlanTransitions.some((transition) => transition.fromStepId === "judge-seeding-video" && transition.onStatus === "success" && transition.toStepId === "observe-next-item-page-state")
    && routePlanTransitions.some((transition) => transition.fromStepId === "persist-seeding-candidate-record" && transition.onStatus === "success" && transition.toStepId === "observe-next-item-page-state")
    && routePlanTransitions.some((transition) => transition.fromStepId === "observe-next-item-page-state" && transition.onStatus === "success" && transition.toStepId === "analyze-next-item-target-candidate")
    && routePlanTransitions.some((transition) => transition.fromStepId === "analyze-next-item-target-candidate" && transition.onStatus === "success" && transition.toStepId === "locate-next-item-target")
    && routePlanTransitions.some((transition) => transition.fromStepId === "locate-next-item-target" && transition.onStatus === "success" && transition.toStepId === "normalize-next-video-arrow")
    && routePlanTransitions.some((transition) => transition.fromStepId === "normalize-next-video-arrow" && transition.onStatus === "success" && transition.toStepId === "click-next-video-arrow")
    && routePlanTransitions.some((transition) => transition.fromStepId === "click-next-video-arrow" && transition.onStatus === "success" && transition.toStepId === "capture-next-item-verification-viewport")
    && routePlanTransitions.some((transition) => transition.fromStepId === "verify-next-item-advanced" && transition.onStatus === "success" && transition.toStepId === "capture-video-viewport")
    && analyzeNext?.stepKind === "ai"
    && analyzeNext.promptContractId === "vision.nextItemTargetCandidate.v1"
    && analyzeNext.inputRefs.includes("promptInputRef")
    && analyzeNext.inputRefs.includes("screenshotEvidenceRef")
    && analyzeNext.outputRefPolicy.storeAs.includes("aiTargetCandidateRef")
    && analyzeNext.outputRefPolicy.storeAs.includes("sourceAiResultRef")
    && locateNext?.targetAbilityGroupId === "visual-target"
    && locateNext.childCapabilityId === "observe-next-item-target-candidate"
    && locateNext.inputRefs.includes("aiTargetCandidateRef")
    && locateNext.inputRefs.includes("pageStateRef")
    && locateNext.inputRefs.includes("screenshotEvidenceRef")
    && locateNext.outputRefPolicy.storeAs.includes("nextItemTargetCandidateRef")
    && normalizeNext?.targetAbilityGroupId === "geometry-guard"
    && normalizeNext.childCapabilityId === "normalize-coordinate-geometry"
    && normalizeNext.inputRefs.includes("screenshotEvidenceRef")
    && normalizeNext.inputRefs.includes("sourceAiResultRef")
    && normalizeNext.inputRefs.includes("nextItemTargetCandidateRef")
    && clickNext?.targetAbilityGroupId === "mouse-click"
    && clickNext.childCapabilityId === "click-browser-coordinate"
    && clickNext.inputRefs.includes("geometryProofRef")
    && clickNext.inputRefs.includes("sourceTargetRef")
    && verifyNext?.stepKind === "ai"
    && verifyNext.promptContractId === "vision.pagePreparation.v1"
    && !hasForbiddenVideoChangePav
    && !usesLegacyNextVideoScrollPath;
  const hasChain = capture?.outputRefPolicy.storeAs.includes("screenshotEvidenceRef") === true
    && prepare?.inputRefs.includes("screenshotEvidenceRef") === true
    && prepare?.outputRefPolicy.storeAs.includes("promptInputRef") === true
    && startupPreparation?.inputRefs.includes("promptInputRef") === true
    && judge?.stepKind === "ai"
    && judge?.inputRefs.includes("promptInputRef") === true
    && judge?.promptContractId === "vision.productPresence.v1"
    && promptBinding?.requiredInputRefs.includes("promptInputRef") === true
    && promptBinding?.outputSchemaRef === "ai.product_presence_judgment.v1"
    && !judgeLeaksNextTargetCandidate
    && !hasForbiddenMapSamplingInternals
    && !hasForbiddenUncertainBranch
    && !hasForbiddenHumanReviewHandoff
    && !duplicatesRoutePlanOwnedSteps
    && !duplicatesRoutePlanOwnedTransitions
    && !mapOwnsAiSuccessRouting
    && routePlanOwnsProductYesNoRouting
    && hasAutomaticNonProductClickPath;

  return hasChain
    ? []
    : [createPromptContractFinding(
      record,
      "Seeding video map packages must be weak routePlanBoundMap entry spines: startup/product AI handoffs may use promptInputRef, but frame-specific sampling refs/steps and post-judgment action chains belong to Route Plan or ability owners. ProductPresence must stay binary route-only and must not leak next-item target candidate ownership. Advance-next-item must pass observe-next-item-page-state -> analyze-next-item-target-candidate -> locate-next-item-target -> normalize-next-video-arrow, and click-next-video-arrow must pass through post-click visible-state verification before capture-video-viewport. Non-AI video-changed PAV, product_uncertain/review_required/request-human-review handoff is forbidden.",
    )];
};