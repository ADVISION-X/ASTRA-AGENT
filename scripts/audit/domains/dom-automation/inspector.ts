import { type InspectorContext, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
import { inspectDomBoundaries } from "./components/inspect-dom-boundaries.js";
import { inspectDomContracts } from "./components/inspect-dom-contracts.js";
import { inspectDomFoundationGates } from "./components/inspect-dom-foundation-gates.js";
import { inspectDomRuntimeGuards } from "./components/inspect-dom-runtime-guards.js";
import { createDomFindingCollector } from "./components/dom-inspector-support.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const project = context.project;
  const scopedContext = { ...context, project };
  const collector = createDomFindingCollector();

  inspectDomContracts(scopedContext, collector);
  inspectDomRuntimeGuards(scopedContext, collector);
  const inspectedFiles = inspectDomBoundaries(scopedContext, collector);
  inspectDomFoundationGates(scopedContext, collector);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
      executedChecks: executedChecksForPlan(context),
    findings: collector.findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
