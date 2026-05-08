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
  const startupCapture = steps.find((step) => step.stepId === "capture-startup-video-viewport");
  const startupPrepare = steps.find((step) => step.stepId === "prepare-startup-ai-input");
  const startupPreparation = steps.find((step) => step.stepId === "startup-preparation");
  const currentCapture = steps.find((step) => step.stepId === "capture-current-video-viewport");
  const currentPrepare = steps.find((step) => step.stepId === "prepare-current-video-ai-input");
  const judge = steps.find((step) => step.stepId === "judge-seeding-video");
  const observeCommentsState = steps.find((step) => step.stepId === "observe-comments-entry-page-state");
  const analyzeComments = steps.find((step) => step.stepId === "analyze-comments-entry-target-candidate");
  const locateComments = steps.find((step) => step.stepId === "locate-comments-entry-target");
  const normalizeComments = steps.find((step) => step.stepId === "normalize-comments-target");
  const clickComments = steps.find((step) => step.stepId === "click-comments-button");
  const writeSeedingEvidence = steps.find((step) => step.stepId === "write-seeding-evidence-record");
  const finalizeSeedingPacket = steps.find((step) => step.stepId === "finalize-seeding-evidence-packet");
  const finalizeSeedingBrowseLedger = steps.find((step) => step.stepId === "finalize-seeding-browse-ledger");
  const pressNext = steps.find((step) => step.stepId === "press-next-video-key");
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
    (transition.fromStepId === "startup-preparation" || transition.fromStepId === "judge-seeding-video")
    && transition.onStatus === "success"
  );
  const judgeLeaksNextTargetCandidate = judge?.outputRefPolicy.storeAs.includes("aiTargetCandidateRef") === true
    || judge?.outputRefPolicy.storeAs.includes("nextItemTargetCandidateRef") === true
    || promptBinding?.outputSchemaRef === "ai.visual_target_candidate_analysis.v1";
  const routePlanOwnsProductYesNoRouting = routePlanTransitions.some((transition) =>
    transition.transitionId === "judge-seeding-video:read-comments-and-save-evidence"
    && transition.onStatus === "success"
    && transition.toStepId === "observe-comments-entry-page-state"
  ) && routePlanTransitions.some((transition) =>
    transition.transitionId === "judge-seeding-video:skip-current-video"
    && transition.onStatus === "success"
    && transition.toStepId === "observe-next-item-page-state"
  );
  const hasGovernedPositiveCommentsPath =
    routePlanTransitions.some((transition) => transition.fromStepId === "judge-seeding-video" && transition.onStatus === "success" && transition.toStepId === "observe-comments-entry-page-state")
    && routePlanTransitions.some((transition) => transition.fromStepId === "observe-comments-entry-page-state" && transition.onStatus === "success" && transition.toStepId === "analyze-comments-entry-target-candidate")
    && routePlanTransitions.some((transition) => transition.fromStepId === "analyze-comments-entry-target-candidate" && transition.onStatus === "success" && transition.toStepId === "locate-comments-entry-target")
    && routePlanTransitions.some((transition) => transition.fromStepId === "locate-comments-entry-target" && transition.onStatus === "success" && transition.toStepId === "normalize-comments-target")
    && routePlanTransitions.some((transition) => transition.fromStepId === "normalize-comments-target" && transition.onStatus === "success" && transition.toStepId === "click-comments-button")
    && observeCommentsState?.targetAbilityGroupId === "page-state"
    && observeCommentsState.childCapabilityId === "observe-video-surface"
    && observeCommentsState.inputRefs.includes("screenshotEvidenceRef")
    && observeCommentsState.inputRefs.includes("targetUrl")
    && observeCommentsState.outputRefPolicy.storeAs.includes("pageStateRef")
    && analyzeComments?.stepKind === "ai"
    && analyzeComments.promptContractId === "vision.commentsEntryTargetCandidate.v1"
    && analyzeComments.inputRefs.includes("promptInputRef")
    && analyzeComments.inputRefs.includes("screenshotEvidenceRef")
    && analyzeComments.outputRefPolicy.storeAs.includes("aiTargetCandidateRef")
    && analyzeComments.outputRefPolicy.storeAs.includes("sourceAiResultRef")
    && locateComments?.targetAbilityGroupId === "visual-target"
    && locateComments.childCapabilityId === "observe-comments-button"
    && locateComments.inputRefs.includes("aiTargetCandidateRef")
    && locateComments.inputRefs.includes("pageStateRef")
    && locateComments.inputRefs.includes("screenshotEvidenceRef")
    && locateComments.outputRefPolicy.storeAs.includes("visualTargetRef")
    && normalizeComments?.targetAbilityGroupId === "geometry-guard"
    && normalizeComments.childCapabilityId === "normalize-coordinate-geometry"
    && normalizeComments.inputRefs.includes("visualTargetRef")
    && clickComments?.targetAbilityGroupId === "mouse-click"
    && clickComments.childCapabilityId === "click-browser-coordinate"
    && clickComments.inputRefs.includes("visualTargetRef")
    && clickComments.inputRefs.includes("geometryProofRef")
    && routePlanTransitions.some((transition) => transition.fromStepId === "analyze-comment-intent" && transition.onStatus === "success" && transition.toStepId === "write-seeding-evidence-record")
    && routePlanTransitions.some((transition) => transition.fromStepId === "write-seeding-evidence-record" && transition.onStatus === "success" && transition.toStepId === "finalize-seeding-evidence-packet")
    && routePlanTransitions.some((transition) => transition.fromStepId === "finalize-seeding-evidence-packet" && transition.onStatus === "success" && transition.toStepId === "finalize-seeding-browse-ledger")
    && writeSeedingEvidence?.targetAbilityGroupId === "forensics-persistence"
    && writeSeedingEvidence.childCapabilityId === "write-evidence-record"
    && writeSeedingEvidence.inputRefs.includes("commentsEvidenceRef")
    && finalizeSeedingPacket?.targetAbilityGroupId === "forensics-persistence"
    && finalizeSeedingPacket.childCapabilityId === "finalize-evidence-packet"
    && finalizeSeedingPacket.inputRefs.includes("productPresenceAiResultRef")
    && finalizeSeedingPacket.inputRefs.includes("commentIntentAiResultRef")
    && finalizeSeedingBrowseLedger?.targetAbilityGroupId === "forensics-persistence"
    && finalizeSeedingBrowseLedger.childCapabilityId === "finalize-browse-ledger"
    && finalizeSeedingBrowseLedger.inputRefs.includes("productPresenceAiResultRef")
    && finalizeSeedingBrowseLedger.inputRefs.includes("evidencePacketRecordRef");
  const hasForbiddenUncertainBranch = judgeTransitions.some((transition) =>
    transition.transitionId.includes("uncertain")
    || transition.toStepId === "request-human-review"
  );
  const usesLegacyNextVideoScrollPath =
    requiredCapabilities.includes("mouse-scroll")
    || requiredChildCapabilities.includes("observe-next-video-region")
    || requiredChildCapabilities.includes("scroll-browser-viewport");
  const hasForbiddenMapSamplingInternals = buildFrameSpecificMapTokens().some((token) => record.text.includes(token));
  const hasAutomaticNonProductAdvancePath =
    record.mapPackage.operationalMap.routePlanId === "product-discovery-route-plan.v1"
    && record.mapPackage.operationalMap.mapKind === "routePlanBoundMap"
    && routePlanTransitions.some((transition) => transition.fromStepId === "judge-seeding-video" && transition.onStatus === "success" && transition.toStepId === "observe-next-item-page-state")
    && routePlanTransitions.some((transition) => transition.fromStepId === "finalize-seeding-browse-ledger" && transition.onStatus === "success" && transition.toStepId === "observe-next-item-page-state")
    && routePlanTransitions.some((transition) => transition.fromStepId === "observe-next-item-page-state" && transition.onStatus === "success" && transition.toStepId === "press-next-video-key")
    && routePlanTransitions.some((transition) => transition.fromStepId === "press-next-video-key" && transition.onStatus === "success" && transition.toStepId === "capture-next-item-verification-viewport")
    && routePlanTransitions.some((transition) => transition.fromStepId === "verify-next-item-advanced" && transition.onStatus === "success" && transition.toStepId === "capture-current-video-viewport")
    && pressNext?.targetAbilityGroupId === "text-input"
    && pressNext.childCapabilityId === "press-navigation-key"
    && pressNext.inputRefs.includes("pageStateRef")
    && pressNext.inputRefs.includes("screenshotEvidenceRef")
    && pressNext.outputRefPolicy.storeAs.includes("abilityResultRef")
    && pressNext.outputRefPolicy.storeAs.includes("nextItemAdvanceProofRef")
    && verifyNext?.stepKind === "ai"
    && verifyNext.promptContractId === "vision.nextItemAdvanced.v1"
    && !hasForbiddenVideoChangePav
    && !usesLegacyNextVideoScrollPath;
  const hasRoutePlanOwnedStartupGate =
    routePlanTransitions.some((transition) => transition.fromStepId === "capture-startup-video-viewport" && transition.onStatus === "success" && transition.toStepId === "prepare-startup-ai-input")
    && routePlanTransitions.some((transition) => transition.fromStepId === "prepare-startup-ai-input" && transition.onStatus === "success" && transition.toStepId === "startup-preparation")
    && routePlanTransitions.some((transition) => transition.fromStepId === "startup-preparation" && transition.onStatus === "success" && transition.toStepId === "judge-seeding-video")
    && startupCapture?.outputRefPolicy.storeAs.includes("screenshotEvidenceRef") === true
    && startupPrepare?.inputRefs.includes("screenshotEvidenceRef") === true
    && startupPrepare?.outputRefPolicy.storeAs.includes("promptInputRef") === true
    && startupPreparation?.inputRefs.includes("promptInputRef") === true
    && currentCapture?.outputRefPolicy.storeAs.includes("screenshotEvidenceRef") === true
    && currentPrepare?.inputRefs.includes("screenshotEvidenceRef") === true
    && currentPrepare?.outputRefPolicy.storeAs.includes("promptInputRef") === true
    && routePlanTransitions.some((transition) => transition.fromStepId === "capture-current-video-viewport" && transition.onStatus === "success" && transition.toStepId === "prepare-current-video-ai-input")
    && routePlanTransitions.some((transition) => transition.fromStepId === "prepare-current-video-ai-input" && transition.onStatus === "success" && transition.toStepId === "judge-seeding-video");
  const hasChain = hasRoutePlanOwnedStartupGate
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
    && hasGovernedPositiveCommentsPath
    && hasAutomaticNonProductAdvancePath;

  return hasChain
    ? []
    : [createPromptContractFinding(
      record,
      "Seeding video map packages must keep only the open entry local while Route Plan owns capture-startup-video-viewport -> prepare-startup-ai-input -> startup-preparation -> judge-seeding-video and capture-current-video-viewport -> prepare-current-video-ai-input -> judge-seeding-video. ProductPresence must stay binary route-only and must not leak target candidate ownership. Product-yes must pass observe-comments-entry-page-state -> analyze-comments-entry-target-candidate -> locate-comments-entry-target -> normalize-comments-target -> click-comments-button -> write-seeding-evidence-record -> finalize-seeding-evidence-packet -> finalize-seeding-browse-ledger with vision.commentsEntryTargetCandidate.v1. Advance-next-item must pass observe-next-item-page-state -> press-next-video-key -> capture-next-item-verification-viewport -> prepare-next-item-verification-ai-input -> verify-next-item-advanced before capture-current-video-viewport, and press-next-video-key must use text-input/press-navigation-key with pageStateRef. Non-AI video-changed PAV, product_uncertain/review_required/request-human-review handoff is forbidden.",
    )];
};