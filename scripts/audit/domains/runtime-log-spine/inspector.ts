import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => ({
  capabilityDomain: context.planEntry.capabilityDomain,
  reportedLawIds: context.planEntry.lawIds,
  findings: [],
  inspectedFiles: [],
});