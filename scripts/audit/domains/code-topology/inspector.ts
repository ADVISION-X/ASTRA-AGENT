import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectCodeTopology } from "./components/inspect-code-topology.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Code Topology Owner Inspector",
  inspectorId: "code-topology-owner",
  capabilityDomain: "code-topology",
  inspectorEntry: "scripts/audit/domains/code-topology/inspector.ts",
  ownedPaths: [".github/instructions/cursor-rules", "docs/法案辅助文件"],
  pendingSummary: "code-topology enforcement is active but canonical phase-doc directories are not fully established yet",
  implementedSummary: "code-topology owner is enforcing canonical law, docs, and runtime-data boundaries",
  extraChecks: inspectCodeTopology,
});