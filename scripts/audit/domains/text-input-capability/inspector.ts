import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { TEXT_INPUT_PRODUCTION_ROOT } from "./config.js";
import {
  checkLawBaseline,
  checkFileCount,
  checkActiveChildren,
  checkForbiddenChildren,
  checkForbiddenFields,
  checkPrimitivePort,
  checkProofIntegrity,
} from "./run-inspector.js";

/**
 * Text Input Capability Inspector
 *
 * Answers 9 questions:
 *   1. file count <= 14?
 *   2. active children = type-approved-text-once / press-approved-key-once / clear-focused-input-once?
 *   3. no paste-text / replace-input / commit-input / press-navigation-key?
 *   4. no clipboard lifecycle files?
 *   5. no postActionVerification / pageReady / pageCorrect / actionVerified?
 *   6. no map/binding/route/package/selection/branch-token fields?
 *   7. Text Input does not import AI/mouse/screenshot/geometry/orchestration runtime?
 *   8. primitive port exposes only typeText / pressKey / clearFocusedInput?
 *   9. proof only proves primitive input truth?
 */
export const textInputCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Text Input Capability Inspector",
  inspectorId: "text-input-capability-owner",
  capabilityDomain: "text-input-capability",
  inspectorEntry: "scripts/audit/domains/text-input-capability/inspector.ts",
  ownedPaths: [TEXT_INPUT_PRODUCTION_ROOT],
  pendingSummary:
    "text-input-capability law exists; awaiting atomic rebuild",
  implementedSummary:
    "text-input-capability rebuilt as 3-child atomic keyboard input group",
  extraChecks: async () => {
    const [
      law,
      fileCount,
      activeChildren,
      forbiddenChildren,
      forbiddenFields,
      primitivePort,
      proofIntegrity,
    ] = await Promise.all([
      checkLawBaseline(),
      checkFileCount(),
      checkActiveChildren(),
      checkForbiddenChildren(),
      checkForbiddenFields(),
      checkPrimitivePort(),
      checkProofIntegrity(),
    ]);

    return {
      findings: [
        ...law.findings,
        ...fileCount.findings,
        ...activeChildren.findings,
        ...forbiddenChildren.findings,
        ...forbiddenFields.findings,
        ...primitivePort.findings,
        ...proofIntegrity.findings,
      ],
      phases: [
        law.phase,
        fileCount.phase,
        activeChildren.phase,
        forbiddenChildren.phase,
        forbiddenFields.phase,
        primitivePort.phase,
        proofIntegrity.phase,
      ],
    };
  },
});
