import { getAuditProject } from "../../../core/ts-morph.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { inspectDocRuntimeTopology } from "./inspect-doc-runtime-topology.js";
import { inspectSourceBoundaryTopology } from "./inspect-source-boundary-topology.js";
import { inspectTopologyEscapeHatches } from "./inspect-topology-escape-hatches.js";

export const inspectCodeTopology = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const project = getAuditProject();
    const docRuntime = await inspectDocRuntimeTopology(context);
    const sourceBoundary = await inspectSourceBoundaryTopology(context, project);
    const escapeHatches = inspectTopologyEscapeHatches(project);

    return {
      findings: [...docRuntime.findings, ...sourceBoundary.findings, ...escapeHatches.findings],
      phases: [...docRuntime.phases, ...sourceBoundary.phases, ...escapeHatches.phases],
    };
};