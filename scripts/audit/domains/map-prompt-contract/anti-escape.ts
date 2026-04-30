import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-003-V1";

export async function runAntiEscape(context: InspectorContext): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const hasOwnerManifest = context.manifestsByDomain.has("map-prompt-contract");

  if (hasOwnerManifest) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "scripts/audit/domains/map-prompt-contract/manifest.json",
      line: 1,
      severity: "error",
      message: "Standalone map-prompt-contract inspector must not declare a manifest owner entry because audit:build only supports unique capability-domain owners.",
    }));
  }

  return {
    findings,
    phase: createPhase(
      "anti-escape",
      findings.length === 0 ? "PASS" : "SCRIPT OVERREACH",
      findings.length === 0,
      findings.length === 0
        ? "Standalone map-prompt-contract enforcement stays outside owner-manifest registration and does not collide with audit:build owner loading."
        : "Standalone map-prompt-contract enforcement attempted to escape into owner-manifest registration.",
    ),
  };
}