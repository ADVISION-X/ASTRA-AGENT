import { runLocalBrowserSessionBoundaryChecks } from "./run-local-browser-session-boundary-checks.js";
import { runLocalBrowserSessionFoundationChecks } from "./run-local-browser-session-foundation-checks.js";
import { runLocalBrowserSessionRuntimeChecks } from "./run-local-browser-session-runtime-checks.js";

export async function inspectLocalBrowserSessionBoundary() {
  const [foundation, runtime, boundary] = await Promise.all([
    runLocalBrowserSessionFoundationChecks(),
    runLocalBrowserSessionRuntimeChecks(),
    runLocalBrowserSessionBoundaryChecks(),
  ]);

  return {
    findings: [...foundation.findings, ...runtime.findings, ...boundary.findings],
    phases: [...foundation.phases, ...runtime.phases, ...boundary.phases],
  };
}
