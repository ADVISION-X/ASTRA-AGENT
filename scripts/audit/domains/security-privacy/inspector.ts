import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { runSecurityPrivacyExtraChecks } from "./security-privacy-extra-checks.js";

export const securityPrivacyInspector = createPendingDomainInspector({
  inspector: "GrassEye Security Privacy Owner Inspector",
  inspectorId: "security-privacy-owner",
  capabilityDomain: "security-privacy",
  inspectorEntry: "scripts/audit/domains/security-privacy/inspector.ts",
  ownedPaths: ["src/lib/browser", "src/capabilities/forensics-persistence", "src/lib/storage", "src/lib/local-ai"],
  pendingSummary: "security-privacy implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "security and privacy boundaries are enforced across local host binding, local data, and no secret export paths",
  extraChecks: runSecurityPrivacyExtraChecks,
});
