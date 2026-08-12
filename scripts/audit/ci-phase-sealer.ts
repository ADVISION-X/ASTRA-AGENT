import { buildCiPhasePlan, preArtifactPlannedSteps } from "./ci-full-phase-plan.js";
import type { AcceptanceLeafSkeleton } from "./ci-acceptance-leaf-plan.js";
import type { FailFast } from "./ci-fail-fast.js";

const sealLawId = preArtifactPlannedSteps
  .find(([phase]) => phase === "generated-plan-runner")?.[4] ?? null;

export const sealCiPhasePlanOrFail = (
  acceptanceSkeletons: readonly AcceptanceLeafSkeleton[],
  failFast: FailFast,
): ReturnType<typeof buildCiPhasePlan> => {
  const startedAtMs = Date.now();
  try {
    return buildCiPhasePlan(acceptanceSkeletons);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const endedAtMs = Date.now();
    failFast(2, {
      phase: "active-law-full-coverage",
      command: "internal:sealAcceptanceAuthority()",
      lawId: sealLawId,
      filePath: "scripts/audit/ci-acceptance-leaf-plan.ts",
      message,
      minimalFixHint: "Repair the single acceptance skeleton-to-generated-authority seal before rerunning npm run ci:full.",
    }, {
      command: "internal:sealAcceptanceAuthority()",
      durationMs: Math.max(0, endedAtMs - startedAtMs),
      endedAt: new Date(endedAtMs).toISOString(),
      error: message,
      lawId: sealLawId,
      name: "active-law-full-coverage",
      ownerId: "audit-system",
      phase: "active-law-full-coverage",
      startedAt: new Date(startedAtMs).toISOString(),
      status: "FAIL",
      timeoutMs: 0,
    });
  }
};
