import { acceptanceLawBindings, type AcceptanceLawBinding } from "./ci-acceptance-law-bindings.js";
import {
  buildAcceptancePackageSkeletons,
  selectExecutableAcceptanceSkeletons,
  type AcceptanceLeafSkeleton,
} from "./ci-acceptance-leaf-plan.js";
import { buildCiPhasePlan, preArtifactPlannedSteps } from "./ci-full-phase-plan.js";
import type { FailFast } from "./ci-fail-fast.js";

const sealLawId = preArtifactPlannedSteps
  .find(([phase]) => phase === "generated-plan-runner")?.[4] ?? null;

const failAcceptanceAuthority = (
  command: string,
  message: string,
  failFast: FailFast,
  startedAtMs: number,
): never => {
  const endedAtMs = Date.now();
  failFast(2, {
    phase: "active-law-full-coverage",
    command,
    lawId: sealLawId,
    filePath: "scripts/audit/ci-acceptance-leaf-plan.ts",
    message,
    minimalFixHint: "Repair the single acceptance skeleton-to-generated-authority seal before rerunning npm run ci:full.",
  }, {
    clauseId: null,
    command,
    durationMs: Math.max(0, endedAtMs - startedAtMs),
    endedAt: new Date(endedAtMs).toISOString(),
    evidenceFacet: null,
    error: message,
    lawId: sealLawId,
    name: "active-law-full-coverage",
    ownerId: "audit-system",
    phase: "active-law-full-coverage",
    startedAt: new Date(startedAtMs).toISOString(),
    status: "FAIL",
    timeoutMs: 0,
  });
};

export const buildAcceptancePackageSkeletonsOrFail = (
  failFast: FailFast,
): readonly AcceptanceLeafSkeleton[] => {
  const startedAtMs = Date.now();
  try {
    return buildAcceptancePackageSkeletons();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failAcceptanceAuthority("internal:discoverAcceptancePackageSkeletons()", message, failFast, startedAtMs);
  }
};

export const sealCiPhasePlanOrFail = (
  acceptanceSkeletons: readonly AcceptanceLeafSkeleton[],
  failFast: FailFast,
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding> = acceptanceLawBindings,
): ReturnType<typeof buildCiPhasePlan> => {
  const startedAtMs = Date.now();
  try {
    return buildCiPhasePlan(selectExecutableAcceptanceSkeletons(acceptanceSkeletons, lawBindings));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failAcceptanceAuthority("internal:sealAcceptanceAuthority()", message, failFast, startedAtMs);
  }
};
