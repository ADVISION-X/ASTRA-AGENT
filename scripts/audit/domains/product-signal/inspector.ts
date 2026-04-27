import { createPhase } from "../../core/result.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Product Signal Owner Inspector",
  inspectorId: "product-signal-owner",
  capabilityDomain: "product-signal",
  inspectorEntry: "scripts/audit/domains/product-signal/inspector.ts",
  ownedPaths: ["src/lib/local-ai", "src/types/product-opportunity.ts", "src/features/local-data"],
  pendingSummary: "product-signal implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "product-signal logic is implemented through structured candidate generation and evidence-backed persistence",
  extraChecks: async () => {
    const agentSource = await readTextFile(pathFromRepoRoot("src/features/agent/agent-service.ts"));
    const aiGatewaySource = await readTextFile(pathFromRepoRoot("src/lib/local-ai/local-ai-gateway.ts"));
    const aiExecutionSource = await readTextFile(pathFromRepoRoot("src/lib/local-ai/governed-task-execution.ts"));

    const nonProductBranchIndex = agentSource.indexOf('browseDecision.decision === "product_no_high_confidence"');
    const candidateCreationIndex = agentSource.indexOf("const candidate = ProductOpportunityCandidateSchema.parse({");
    const nonProductGuardPassed =
      nonProductBranchIndex >= 0 &&
      candidateCreationIndex > nonProductBranchIndex &&
      agentSource.includes("await this.adapter.clickNotInterested") &&
      agentSource.includes("continue after non-product video") &&
      agentSource.includes("productPresence: visionPayload") &&
      (aiGatewaySource.includes('const negativeHints = ["no product", "non-product", "not a product", "pet clip"]') ||
        aiExecutionSource.includes('const negativeHints = ["no product", "non-product", "not a product", "pet clip"]'));

    return {
      phases: [
        createPhase(
          "non-product-candidate-guard",
          nonProductGuardPassed ? "PASS" : "CODE VIOLATION",
          nonProductGuardPassed,
          nonProductGuardPassed
            ? "Product-signal pipeline keeps non-product videos out of candidate creation and preserves negative-hint detection."
            : "Product-signal pipeline is missing the non-product guard before candidate creation.",
        ),
      ],
    };
  },
});