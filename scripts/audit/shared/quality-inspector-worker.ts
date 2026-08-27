import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { inspectDomain as inspectAgentProductionRuntime } from "../domains/agent-production-runtime/inspector.js";
import { inspectDomain as inspectAppShellUi } from "../domains/app-shell-ui/inspector.js";
import { inspectDomain as inspectArchitectureBoundary } from "../domains/architecture-boundary/inspector.js";
import { inspectDomain as inspectCapabilityGovernance } from "../domains/capability-governance/inspector.js";
import { inspectDomain as inspectCodePurity } from "../domains/code-purity/inspector.js";
import { inspectDomain as inspectForensics } from "../domains/forensics-persistence-capability/inspector.js";
import { inspectDomain as inspectGpt } from "../domains/gpt/inspector.js";
import { inspectDomain as inspectLocalAppShell } from "../domains/local-app-shell/inspector.js";
import { inspectDomain as inspectLocalBrowserSession } from "../domains/local-browser-session/inspector.js";
import { inspectDomain as inspectRuntimeLogSpine } from "../domains/runtime-log-spine/inspector.js";
import { inspectDomain as inspectStartupEntrypoint } from "../domains/startup-entrypoint/inspector.js";
import { inspectDomain as inspectSystemSecurity } from "../domains/system-security/inspector.js";
import { inspectDomain as inspectWorkbenchApiBoundary } from "../domains/workbench-api-boundary/inspector.js";
import { createAuditProject } from "./project.js";
import type { InspectorContext, SessionInspectorOutput } from "./inspector-contracts.js";

type DomainInspector = (context: InspectorContext) => Promise<SessionInspectorOutput>;
type WorkerRequest = {
  capabilityDomain: string;
  laws: Array<{ lawId: string; forbiddenCount: number; requiredStaticModes: string[]; targetPaths: string[]; targetSet: { queryRef: string; count: number } }>;
  ownerInspectorPath: string;
  sealedRoot: string;
  targetPaths: string[];
};

const inspectors: Record<string, DomainInspector> = {
  "agent-production-runtime": inspectAgentProductionRuntime,
  "app-shell-ui": inspectAppShellUi,
  "architecture-boundary": inspectArchitectureBoundary,
  "capability-governance": inspectCapabilityGovernance,
  "code-purity": inspectCodePurity,
  "forensics-persistence-capability": inspectForensics,
  gpt: inspectGpt,
  "local-app-shell": inspectLocalAppShell,
  "local-browser-session": inspectLocalBrowserSession,
  "runtime-log-spine": inspectRuntimeLogSpine,
  "startup-entrypoint": inspectStartupEntrypoint,
  "system-security": inspectSystemSecurity,
  "workbench-api-boundary": inspectWorkbenchApiBoundary,
};

const request = (): WorkerRequest => {
  const path = process.env.GOVERNANCE_INSPECTION_REQUEST?.trim();
  if (!path) throw new Error("GOVERNANCE_INSPECTION_REQUEST_MISSING");
  return JSON.parse(readFileSync(path, "utf8")) as WorkerRequest;
};

const plan = (input: WorkerRequest): InspectorContext["planEntry"] => ({
  capabilityDomain: input.capabilityDomain,
  manifestPath: `scripts/audit/domains/${input.capabilityDomain}/manifest.json`,
  ownerInspectorPath: input.ownerInspectorPath,
  executionGroup: "domain",
  lawIds: input.laws.map((law) => law.lawId),
});

export const runInspectionWorker = async (): Promise<void> => {
  const input = request();
  const inspector = inspectors[input.capabilityDomain];
  if (!inspector) throw new Error(`GOVERNANCE_INSPECTOR_MISSING:${input.capabilityDomain}`);
  const planEntry = plan(input);
  const context: InspectorContext = {
    project: createAuditProject(input.sealedRoot, input.targetPaths),
    selectedLawId: input.laws[0]?.lawId ?? "",
    sealedRoot: input.sealedRoot,
    targetSet: {
      queryRef: `scope:${input.capabilityDomain}#domain-union`,
      count: input.targetPaths.length,
    },
    targetPaths: input.targetPaths,
    lawRequirements: input.laws,
    planEntry,
    generatedPlan: [planEntry],
  };
  const output = await inspector(context);
  process.stdout.write(`GOVERNANCE_INSPECTOR_RESULT ${JSON.stringify(output)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runInspectionWorker();
