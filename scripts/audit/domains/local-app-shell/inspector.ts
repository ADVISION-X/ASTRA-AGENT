import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { runLocalShellBoundaryChecks } from "./run-local-shell-boundary-checks.js";
import { runStartupBootstrapChecks } from "./run-startup-bootstrap-checks.js";

export const inspectLocalAppShellBoundary = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const shellBoundaryFindings = await runLocalShellBoundaryChecks();
  const startupFindings = await runStartupBootstrapChecks();
  const findings = [...shellBoundaryFindings, ...startupFindings];
  const hasShellBoundaryViolations = findings.some((finding) => {
    return finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-001-V1" || finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-002-V1";
  });
  const hasStartupViolations = findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-004-V1");

  return {
    findings,
    phases: [
      createPhase("local-shell-boundary", hasShellBoundaryViolations ? "LAW-SCRIPT DRIFT" : "PASS", !hasShellBoundaryViolations, hasShellBoundaryViolations ? "Local app shell boundary wiring is incomplete or drifted." : "Server and workbench keep localhost shell, local runtime, local AI, browser, and data boundaries together."),
      createPhase("startup-bootstrap-boundary", hasStartupViolations ? "CODE VIOLATION" : "PASS", !hasStartupViolations, hasStartupViolations ? "Startup bootstrap path drifted away from the governed dependency -> start -> health -> open sequence." : "Startup bootstrap stays bounded to dependency readiness, health-gated service launch, and page opening."),
    ],
  };
};