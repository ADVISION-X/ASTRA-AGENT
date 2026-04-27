import { createFinding, createPhase } from "../../core/result.js";
import { getAuditProject, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Operator Control Owner Inspector",
  inspectorId: "operator-control-owner",
  capabilityDomain: "operator-control",
  inspectorEntry: "scripts/audit/domains/operator-control/inspector.ts",
  ownedPaths: ["src/app/server.ts", "src/lib/local-runtime/workbench.ts", "src/features/agent", "src/features/operator-control/console-view.ts"],
  pendingSummary: "operator-control implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "operator-control is implemented through the local console, task controls, and candidate disposition workflow",
  extraChecks: async () => {
    const findings = [];
    const auditProject = getAuditProject();
    const serverSource = getSourceFileOrThrow(auditProject, "src/app/server.ts");
    const consoleViewSource = getSourceFileOrThrow(auditProject, "src/features/operator-control/console-view.ts");
    const relativeServerPath = toRelativeSourcePath(serverSource);
    const relativeConsoleViewPath = toRelativeSourcePath(consoleViewSource);
    const serverText = serverSource.getFullText();
    const consoleViewText = consoleViewSource.getFullText();

    const requiredServerMarkers = [
      'url.pathname === "/api/tasks/start"',
      'url.pathname === "/api/tasks/pause"',
      'url.pathname === "/api/tasks/stop"',
      'url.pathname === "/api/runtime/reset-store"',
      'url.pathname.endsWith("/review")'
    ];
    for (const marker of requiredServerMarkers) {
      if (!serverText.includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-OPERATOR-CONTROL-001-V1",
            file: relativeServerPath,
            line: 1,
            severity: "error",
            message: `Operator control surface is missing required server marker: ${marker}`,
          }),
        );
      }
    }

    const requiredConsoleMarkers = [
      "reviewCandidate(",
      "deleteCandidate(",
      "resetStore(",
      "/api/tasks/start",
      "/api/tasks/pause",
      "/api/tasks/stop",
      "/api/runtime/reset-store",
      "/api/candidates/export"
    ];
    for (const marker of requiredConsoleMarkers) {
      if (!consoleViewText.includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-OPERATOR-CONTROL-001-V1",
            file: relativeConsoleViewPath,
            line: 1,
            severity: "error",
            message: `Operator console is missing required control marker: ${marker}`,
          }),
        );
      }
    }

    const forbiddenSimulationMarkers = ["/api/demo/run-once", "/api/demo/reset", "actions.runDemo", "actions.resetDemoData"];
    for (const marker of forbiddenSimulationMarkers) {
      if (serverText.includes(marker) || consoleViewText.includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-OPERATOR-CONTROL-001-V1",
            file: serverText.includes(marker) ? relativeServerPath : relativeConsoleViewPath,
            line: 1,
            severity: "error",
            message: `Operator control must not expose simulated runtime controls: ${marker}`,
          }),
        );
      }
    }

    return {
      findings,
      phases: [
        createPhase(
          "operator-console-controls",
          findings.length === 0 ? "PASS" : "CODE VIOLATION",
          findings.length === 0,
          findings.length === 0
            ? "Operator console exposes reset controls, review actions, and runtime control seams."
            : "Operator console is missing required reset, control, or review surfaces.",
        ),
      ],
    };
  },
});