import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { inspectPluginInterventionContract } from "../../../shared/plugin-intervention-contract-inspector.js";

export { inspectDeletedNonPrimaryPaths } from "./scan-deleted-non-primary-paths.js";

export const inspectDeepResearchInterventionContract = (context: InspectorContext) =>
  inspectPluginInterventionContract(context, {
    lawId: "GRASSEYE-DEEP-RESEARCH-061-V1",
    domain: "deep-research-analysis",
    ownerFilePaths: [
      "src/plugins/deep-research-analysis/deep-research-analysis.intervention.ts",
      "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
    ],
    routeFilePath: "src/app/workbench-deep-research-intervention-routes.ts",
    routePrefix: "/api/deep-research-analysis/intervention/",
    handleMethods: ["pauseDeepResearch", "cancelDeepResearch", "takeoverDeepResearch", "resumeDeepResearch"],
    safePointSymbol: "awaitDeepResearchSafePoint",
    interventionSymbol: "requestDeepResearchIntervention",
    acceptancePath: "scripts/acceptance/deep-research-analysis-browser-intervention.acceptance.ts",
  });
