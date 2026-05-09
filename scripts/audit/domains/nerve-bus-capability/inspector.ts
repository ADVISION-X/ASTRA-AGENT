import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runRequiredShapeAttack } from "./required-shape.js";

export const nerveBusCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Nerve Bus Capability Owner Inspector",
  inspectorId: "nerve-bus-capability-owner",
  capabilityDomain: "nerve-bus-capability",
  inspectorEntry: "scripts/audit/domains/nerve-bus-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "nerve-bus-capability law exists but the governed transport spine is not fully locked down yet",
  implementedSummary: "nerve-bus-capability is implemented as a schema-first governed transport spine with AST-backed enforcement",
  extraChecks: async () => {
    const required = await runRequiredShapeAttack();
    const forbidden = runForbiddenShapeAttack();
    const boundary = runBoundaryAttack();
    const antiEscape = runAntiEscapeAttack();

    return {
      findings: [
        ...required.findings,
        ...forbidden.findings,
        ...boundary.findings,
        ...antiEscape.findings,
      ],
      phases: [
        required.phase,
        forbidden.phase,
        boundary.phase,
        antiEscape.phase,
      ],
    };
  },
});
