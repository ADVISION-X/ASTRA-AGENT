import { createPhase } from "../../core/result.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Vision Boundary Owner Inspector",
  inspectorId: "vision-boundary-owner",
  capabilityDomain: "vision-boundary",
  inspectorEntry: "scripts/audit/domains/vision-boundary/inspector.ts",
  ownedPaths: ["src/lib/local-ai", "src/types/local-ai.ts", "src/features/platform-action/visual-target.ts"],
  pendingSummary: "vision-boundary implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "vision-boundary logic is implemented through governed local-AI contracts, typed payloads, and visual-target contracts",
  extraChecks: async () => {
    const visualTargetSource = await readTextFile(pathFromRepoRoot("src/features/platform-action/visual-target.ts")).catch(() => "");
    const coordinatePolicySource = await readTextFile(pathFromRepoRoot("src/features/platform-action/coordinate-action-policy.ts")).catch(() => "");
    const localAiTypesSource = await readTextFile(pathFromRepoRoot("src/types/local-ai.ts"));

    const visualTargetContractPassed =
      visualTargetSource.includes("targetType") &&
      (visualTargetSource.includes("boundingBox") || visualTargetSource.includes("bbox")) &&
      visualTargetSource.includes("confidence") &&
      (visualTargetSource.includes("sourceScreenshotEvidenceId") || visualTargetSource.includes("sourceScreenshotEvidenceRef"));
    const confidenceGatePassed =
      coordinatePolicySource.includes("minimumConfidence") &&
      coordinatePolicySource.includes("visual target confidence") &&
      localAiTypesSource.includes("confidence");

    return {
      findings: [],
      phases: [
        createPhase(
          "visual-target-contract",
          visualTargetContractPassed ? "PASS" : "LAW-SCRIPT DRIFT",
          visualTargetContractPassed,
          visualTargetContractPassed
            ? "Visual targets include type, bbox, confidence, and screenshot evidence binding."
            : "Visual target contract is missing bbox, confidence, or evidence binding markers.",
        ),
        createPhase(
          "confidence-gating",
          confidenceGatePassed ? "PASS" : "LAW-SCRIPT DRIFT",
          confidenceGatePassed,
          confidenceGatePassed
            ? "Vision-boundary outputs remain confidence-aware before stronger actions are planned."
            : "Confidence-gating markers are missing from vision-boundary or coordinate-policy sources.",
        ),
      ],
    };
  },
});