import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { MOUSE_CLICK_PRODUCTION_ROOT } from "./config.js";
import {
  checkLawBaseline,
  checkRegistryChildren,
  checkFixedButtonClickCount,
  checkForbiddenFields,
  checkPrimitiveExecution,
  checkMuscleMemory,
  checkFileCount,
} from "./run-inspector.js";

/**
 * Mouse Click Capability Inspector
 *
 * Answers six questions:
 *   1. Registry contains exactly 3 atomic browser-viewport children?
 *   2. Children fix button/clickCount via constants (not external input)?
 *   3. Schema has no binding/map/package/PAV forbidden fields?
 *   4. Primitive port correctly declares button/clickCount as fixed params?
 *   5. MuscleMemory exposes the 3 gridCell atomic click actions?
 *   6. Law file enumerates all three children?
 */
export const mouseClickCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Mouse Click Capability Inspector",
  inspectorId: "mouse-click-capability-owner",
  capabilityDomain: "mouse-click-capability",
  inspectorEntry: "scripts/audit/domains/mouse-click-capability/inspector.ts",
  ownedPaths: [MOUSE_CLICK_PRODUCTION_ROOT],
  pendingSummary:
    "mouse-click-capability law exists; production atomic child implementation pending",
  implementedSummary:
    "mouse-click-capability is implemented with 3 atomic browser-viewport children",
  extraChecks: async () => {
    const [law, registry, fixed, forbidden, primitive, muscleMemory, fileCount] =
      await Promise.all([
        checkLawBaseline(),
        checkRegistryChildren(),
        checkFixedButtonClickCount(),
        checkForbiddenFields(),
        checkPrimitiveExecution(),
        checkMuscleMemory(),
        checkFileCount(),
      ]);

    return {
      findings: [
        ...law.findings,
        ...registry.findings,
        ...fixed.findings,
        ...forbidden.findings,
        ...primitive.findings,
        ...muscleMemory.findings,
        ...fileCount.findings,
      ],
      phases: [
        law.phase,
        registry.phase,
        fixed.phase,
        forbidden.phase,
        primitive.phase,
        muscleMemory.phase,
        fileCount.phase,
      ],
    };
  },
});
