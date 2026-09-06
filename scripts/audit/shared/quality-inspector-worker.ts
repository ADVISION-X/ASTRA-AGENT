import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { createAuditProject } from "./project.js";
import type { InspectorContext, SessionInspectorOutput } from "./inspector-contracts.js";

type DomainInspector = (context: InspectorContext) => Promise<SessionInspectorOutput>;
type DomainInspectorModule = { inspectDomain: DomainInspector };
type WorkerRequest = {
  capabilityDomain: string;
  laws: Array<{ lawId: string; forbiddenCount: number; requiredStaticModes: string[]; targetPaths: string[]; targetSet: { queryRef: string; count: number } }>;
  ownerInspectorPath: string;
  ownerInspectorPlan: Array<{ capabilityDomain: string; lawIds: string[] }>;
  sealedRoot: string;
  targetPaths: string[];
};

const inspectorLoaders: Record<string, () => Promise<DomainInspectorModule>> = {
  "agent-production-runtime": () => import("../domains/agent-production-runtime/inspector.js"),
  "app-shell-ui": () => import("../domains/app-shell-ui/inspector.js"),
  "architecture-boundary": () => import("../domains/architecture-boundary/inspector.js"),
  "capability-governance": () => import("../domains/capability-governance/inspector.js"),
  "code-purity": () => import("../domains/code-purity/inspector.js"),
  "forensics-persistence-capability": () => import("../domains/forensics-persistence-capability/inspector.js"),
  gpt: () => import("../domains/gpt/inspector.js"),
  "local-app-shell": () => import("../domains/local-app-shell/inspector.js"),
  "local-browser-session": () => import("../domains/local-browser-session/inspector.js"),
  "runtime-log-spine": () => import("../domains/runtime-log-spine/inspector.js"),
  "startup-entrypoint": () => import("../domains/startup-entrypoint/inspector.js"),
  "system-security": () => import("../domains/system-security/inspector.js"),
  "workbench-api-boundary": () => import("../domains/workbench-api-boundary/inspector.js"),
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

const generatedPlan = (input: WorkerRequest): InspectorContext["generatedPlan"] =>
  input.ownerInspectorPlan.map((entry) => ({
    capabilityDomain: entry.capabilityDomain,
    manifestPath: `scripts/audit/domains/${entry.capabilityDomain}/manifest.json`,
    ownerInspectorPath: `scripts/audit/domains/${entry.capabilityDomain}/inspector.ts`,
    executionGroup: "domain",
    lawIds: [...entry.lawIds],
  }));

export const runInspectionWorker = async (): Promise<void> => {
  const input = request();
  const loadInspector = inspectorLoaders[input.capabilityDomain];
  if (!loadInspector) throw new Error(`GOVERNANCE_INSPECTOR_MISSING:${input.capabilityDomain}`);
  const { inspectDomain: inspector } = await loadInspector();
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
    generatedPlan: generatedPlan(input),
  };
  const output = await inspector(context);
  process.stdout.write(`GOVERNANCE_INSPECTOR_RESULT ${JSON.stringify(output)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runInspectionWorker();
