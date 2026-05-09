import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { listRoutePlans } from "../../../../src/map-plugins/route-plans/index.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

const ROUTE_PLAN_ROOT = "src/map-plugins/route-plans";
const CORE_MUSCLES = new Set(["visible-state", "target-action", "evidence-analysis", "advance-next-item"]);

type RoutePlan = ReturnType<typeof listRoutePlans>[number];
type RoutePlanSegment = NonNullable<RoutePlan["muscleSegments"]>[number];
type RoutePlanStep = RoutePlan["steps"][number];

const PRODUCT_DISCOVERY_ROUTE_PLAN_ID = "product-discovery-route-plan.v1";
const COMMENTS_CHAIN_FORBIDDEN_REFS = ["visualTargetRef", "geometryProofRef", "commentsClickActionRef", "commentsOpenVerificationRef"] as const;
const COMMENTS_CHAIN_FORBIDDEN_FIELDS = [
  "bbox",
  "clickPoint",
  "normalizedClickPoint",
  "sourceBoundsX",
  "sourceBoundsY",
  "sourceBoundsWidth",
  "sourceBoundsHeight",
  "normalizedClickPointX",
  "normalizedClickPointY",
] as const;
const COMMENTS_CHAIN_REQUIRED_ORDER = [
  "analyze-comments-entry-target-candidate",
  "observe-comments-button",
  "normalize-comments-target",
  "click-comments-button",
  "verify-comments-open",
  "capture-comments-panel",
] as const;
const COMMENTS_CHAIN_STEP_RULES = [
  { stepId: "analyze-comments-entry-target-candidate", inputRefs: ["promptInputRef", "screenshotEvidenceRef"], outputRefs: ["aiResultRef"] },
  { stepId: "observe-comments-button", inputRefs: ["screenshotEvidenceRef", "aiResultRef", "pageStateRef"], outputRefs: ["visualTargetResultRef"] },
  { stepId: "normalize-comments-target", inputRefs: ["visualTargetResultRef"], outputRefs: ["geometryGuardResultRef"] },
  { stepId: "click-comments-button", inputRefs: ["geometryGuardResultRef"], outputRefs: ["abilityResultRef", "clickResultRef"] },
  { stepId: "verify-comments-open", inputRefs: ["clickResultRef"], outputRefs: ["abilityResultRef", "postActionVerificationResultRef"] },
  { stepId: "capture-comments-panel", inputRefs: ["visualTargetResultRef", "postActionVerificationResultRef", "targetUrl"], outputRefs: ["commentsEvidenceRef"] },
] as const;

const toFinding = (file: string, message: string, detail?: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.MUSCLE_MEMORY_GOVERNANCE,
    file,
    line: 1,
    severity: "fatal",
    message,
    ...(detail ? { detail } : {}),
  });

const getStoredRefs = (step: RoutePlanStep): string[] => step.outputRefPolicy?.storeAs ?? [];

const hasExactRefs = (actualRefs: string[], expectedRefs: readonly string[]) => {
  return actualRefs.length === expectedRefs.length && expectedRefs.every((ref) => actualRefs.includes(ref));
};

const getStep = (routePlan: RoutePlan, stepId: string): RoutePlanStep | undefined =>
  routePlan.steps.find((step) => step.stepId === stepId);

const collectCommentsSegmentLegacyRefFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => {
  const leakedRefs = [...segment.consumesRefs, ...segment.producesRefs].filter((ref) => COMMENTS_CHAIN_FORBIDDEN_REFS.includes(ref as (typeof COMMENTS_CHAIN_FORBIDDEN_REFS)[number]));
  return leakedRefs.length > 0
    ? [toFinding(ROUTE_PLAN_ROOT, "Comments muscle segments must not retain legacy result-ref aliases.", `${routePlanId}:${segment.segmentId}:${leakedRefs.join(",")}`)]
    : [];
};

const collectCommentsStepLegacyRefFindings = (routePlan: RoutePlan): Finding[] => {
  return COMMENTS_CHAIN_STEP_RULES.flatMap((rule) => {
    const step = getStep(routePlan, rule.stepId);
    if (!step) {
      return [toFinding(ROUTE_PLAN_ROOT, "Product-discovery comments chain is missing a required governed step.", `${routePlan.routePlanId}:${rule.stepId}`)];
    }

    const leakedRefs = [...step.inputRefs, ...getStoredRefs(step)].filter((ref) => COMMENTS_CHAIN_FORBIDDEN_REFS.includes(ref as (typeof COMMENTS_CHAIN_FORBIDDEN_REFS)[number]));
    const leakedFields = [...step.inputRefs, ...getStoredRefs(step)].filter((ref) => COMMENTS_CHAIN_FORBIDDEN_FIELDS.includes(ref as (typeof COMMENTS_CHAIN_FORBIDDEN_FIELDS)[number]));

    return [
      ...leakedRefs.map((ref) => toFinding(ROUTE_PLAN_ROOT, "Product-discovery comments chain must not route legacy result-ref aliases.", `${routePlan.routePlanId}:${step.stepId}:${ref}`)),
      ...leakedFields.map((ref) => toFinding(ROUTE_PLAN_ROOT, "Product-discovery comments chain must not route raw geometry fields through Route Plan refs.", `${routePlan.routePlanId}:${step.stepId}:${ref}`)),
    ];
  });
};

const collectCommentsStepContractFindings = (routePlan: RoutePlan): Finding[] => {
  return COMMENTS_CHAIN_STEP_RULES.flatMap((rule) => {
    const step = getStep(routePlan, rule.stepId);
    if (!step) {
      return [];
    }

    const outputRefs = getStoredRefs(step);
    const findings: Finding[] = [];

    if (!hasExactRefs(step.inputRefs, rule.inputRefs)) {
      findings.push(toFinding(ROUTE_PLAN_ROOT, "Product-discovery comments chain must consume only canonical result refs at each step.", `${routePlan.routePlanId}:${step.stepId}:inputs=${step.inputRefs.join(",")}`));
    }
    if (!hasExactRefs(outputRefs, rule.outputRefs)) {
      findings.push(toFinding(ROUTE_PLAN_ROOT, "Product-discovery comments chain must store only canonical result refs at each step.", `${routePlan.routePlanId}:${step.stepId}:outputs=${outputRefs.join(",")}`));
    }
    return findings;
  });
};

const collectCommentsTransitionOrderFindings = (routePlan: RoutePlan): Finding[] => {
  const transitions = routePlan.transitions ?? [];
  const requiredFindings = COMMENTS_CHAIN_REQUIRED_ORDER.slice(0, -1).flatMap((fromStepId, index) => {
    const toStepId = COMMENTS_CHAIN_REQUIRED_ORDER[index + 1]!;
    const hasTransition = transitions.some((transition) =>
      transition.fromStepId === fromStepId
      && transition.toStepId === toStepId
      && transition.onStatus === "success"
    );
    return hasTransition
      ? []
      : [toFinding(ROUTE_PLAN_ROOT, "Product-discovery comments opening muscle must keep the canonical success transition order.", `${routePlan.routePlanId}:${fromStepId}->${toStepId}`)];
  });
  const forbiddenClickToCapture = transitions.find((transition) =>
    transition.fromStepId === "click-comments-button"
    && transition.toStepId === "capture-comments-panel"
  );
  return forbiddenClickToCapture
    ? [
        ...requiredFindings,
        toFinding(ROUTE_PLAN_ROOT, "Mouse Click success must pass through verify-comments-open before capture-comments-panel.", `${routePlan.routePlanId}:${forbiddenClickToCapture.transitionId}`),
      ]
    : requiredFindings;
};

const collectRoutePlanKindFindings = (routePlan: RoutePlan): Finding[] =>
  routePlan.routePlanKind !== "muscle-memory"
    ? [toFinding(ROUTE_PLAN_ROOT, "Route Plan must declare routePlanKind=muscle-memory.", routePlan.routePlanId)]
    : [];

const collectCoreMuscleFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => {
  return CORE_MUSCLES.has(segment.coreMuscle)
    ? []
    : [toFinding(ROUTE_PLAN_ROOT, "Route Plan muscleSegments may only use the four core muscles.", `${routePlanId}:${segment.segmentId}:${segment.coreMuscle}`)];
};

const collectAllowedAbilityGroupFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => {
  return segment.allowedAbilityGroups.includes("map-plugin-package")
    ? [toFinding(ROUTE_PLAN_ROOT, "Muscle segments must not list map-plugin-package as an allowed ability group.", `${routePlanId}:${segment.segmentId}`)]
    : [];
};

const collectRouteLabelFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => {
  return !segment.aiRequired && segment.producesRefs.some((ref: string) => ref.toLowerCase().includes("routelabel"))
    ? [toFinding(ROUTE_PLAN_ROOT, "Non-AI muscle segments must not produce routeLabel refs.", `${routePlanId}:${segment.segmentId}`)]
    : [];
};

const collectSemanticOwnerFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => {
  return segment.aiRequired && segment.semanticOwner !== "ai"
    ? [toFinding(ROUTE_PLAN_ROOT, "Semantic muscle segments must declare semanticOwner=ai.", `${routePlanId}:${segment.segmentId}`)]
    : [];
};

const collectCommentsSegmentResultFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => {
  const requiredRefs = ["visualTargetResultRef", "geometryGuardResultRef", "clickResultRef", "postActionVerificationResultRef"];
  return segment.segmentId === "target-action.comments-entry" && !requiredRefs.every((ref) => segment.producesRefs.includes(ref))
    ? [toFinding(ROUTE_PLAN_ROOT, "Comments-entry muscle segment must publish canonical result refs for visual-target, geometry-guard, mouse-click, and post-action-verification.", `${routePlanId}:${segment.segmentId}`)]
    : [];
};

const collectSegmentMetadataFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => [
  ...collectCoreMuscleFindings(routePlanId, segment),
  ...collectAllowedAbilityGroupFindings(routePlanId, segment),
  ...collectRouteLabelFindings(routePlanId, segment),
  ...collectSemanticOwnerFindings(routePlanId, segment),
  ...collectCommentsSegmentResultFindings(routePlanId, segment),
  ...((segment.segmentId === "target-action.comments-entry" || segment.segmentId === "evidence-analysis.comments")
    ? collectCommentsSegmentLegacyRefFindings(routePlanId, segment)
    : []),
];

export const collectRoutePlanMetadataFindings = (): Finding[] =>
  listRoutePlans().flatMap((routePlan) => [
    ...collectRoutePlanKindFindings(routePlan),
    ...(routePlan.muscleSegments ?? []).flatMap((segment) => collectSegmentMetadataFindings(routePlan.routePlanId, segment)),
    ...(routePlan.routePlanId === PRODUCT_DISCOVERY_ROUTE_PLAN_ID
      ? [
          ...collectCommentsStepLegacyRefFindings(routePlan),
          ...collectCommentsStepContractFindings(routePlan),
          ...collectCommentsTransitionOrderFindings(routePlan),
        ]
      : []),
  ]);
