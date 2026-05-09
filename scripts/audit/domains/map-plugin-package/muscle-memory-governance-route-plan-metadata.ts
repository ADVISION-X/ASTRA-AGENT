import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { listRoutePlans } from "../../../../src/map-plugins/route-plans/index.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

const ROUTE_PLAN_ROOT = "src/map-plugins/route-plans";
const CORE_MUSCLES = new Set(["visible-state", "target-action", "evidence-analysis", "advance-next-item"]);

type RoutePlan = ReturnType<typeof listRoutePlans>[number];
type RoutePlanSegment = NonNullable<RoutePlan["muscleSegments"]>[number];

const toFinding = (file: string, message: string, detail?: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.MUSCLE_MEMORY_GOVERNANCE,
    file,
    line: 1,
    severity: "fatal",
    message,
    ...(detail ? { detail } : {}),
  });

const collectRoutePlanKindFindings = (routePlan: RoutePlan): Finding[] =>
  routePlan.routePlanKind !== "muscle-memory"
    ? [toFinding(ROUTE_PLAN_ROOT, "Route Plan must declare routePlanKind=muscle-memory.", routePlan.routePlanId)]
    : [];

const collectSegmentMetadataFindings = (routePlanId: string, segment: RoutePlanSegment): Finding[] => [
  ...(CORE_MUSCLES.has(segment.coreMuscle)
    ? []
    : [toFinding(ROUTE_PLAN_ROOT, "Route Plan muscleSegments may only use the four core muscles.", `${routePlanId}:${segment.segmentId}:${segment.coreMuscle}`)]),
  ...(segment.allowedAbilityGroups.includes("map-plugin-package")
    ? [toFinding(ROUTE_PLAN_ROOT, "Muscle segments must not list map-plugin-package as an allowed ability group.", `${routePlanId}:${segment.segmentId}`)]
    : []),
  ...(!segment.aiRequired && segment.producesRefs.some((ref: string) => ref.toLowerCase().includes("routelabel"))
    ? [toFinding(ROUTE_PLAN_ROOT, "Non-AI muscle segments must not produce routeLabel refs.", `${routePlanId}:${segment.segmentId}`)]
    : []),
  ...(segment.aiRequired && segment.semanticOwner !== "ai"
    ? [toFinding(ROUTE_PLAN_ROOT, "Semantic muscle segments must declare semanticOwner=ai.", `${routePlanId}:${segment.segmentId}`)]
    : []),
  ...(segment.segmentId === "target-action.comments-entry"
    && !["visualTargetResultRef", "geometryGuardResultRef", "clickResultRef", "postActionVerificationResultRef"].every((ref) => segment.producesRefs.includes(ref))
    ? [toFinding(ROUTE_PLAN_ROOT, "Comments-entry muscle segment must publish canonical result refs for visual-target, geometry-guard, mouse-click, and post-action-verification.", `${routePlanId}:${segment.segmentId}`)]
    : []),
];

export const collectRoutePlanMetadataFindings = (): Finding[] =>
  listRoutePlans().flatMap((routePlan) => [
    ...collectRoutePlanKindFindings(routePlan),
    ...(routePlan.muscleSegments ?? []).flatMap((segment) => collectSegmentMetadataFindings(routePlan.routePlanId, segment)),
  ]);