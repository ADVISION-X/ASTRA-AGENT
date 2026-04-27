import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Comment Intelligence Owner Inspector",
  inspectorId: "comment-intelligence-owner",
  capabilityDomain: "comment-intelligence",
  inspectorEntry: "scripts/audit/domains/comment-intelligence/inspector.ts",
  ownedPaths: ["src/lib/local-ai", "src/types/evidence.ts", "src/features/local-data"],
  pendingSummary: "comment-intelligence implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "comment-intelligence logic is implemented through OCR cleanup, comment-signal parsing, and evidence-bound storage",
});