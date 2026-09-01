import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V25";
const PATHS = {
  contracts: "src/lib/local-runtime/production/contracts.ts",
  transport: "src/lib/local-runtime/production/transport-protocol.ts",
  projection: "src/lib/local-runtime/production/v6-manifest-projection.ts",
  worker: "src/lib/local-runtime/production/worker-session.ts",
  enroll: "scripts/startup/production-runtime-cloud-enroll.ts",
  dependency: "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json",
} as const;
const finding = (checkId: string, filePath: string, message: string): InspectorFinding => createFinding({
  evidenceMode: "static.contract", lawId: LAW_ID,
  clauseId: `${LAW_ID.toLowerCase()}-requirement`, checkId, filePath, message,
});
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");

const inspectContractFields = (source: string, findings: InspectorFinding[]): void => {
  for (const required of ["WebsiteAgentTaskSchema", "WebsiteAgentResultSchema",
    "AgentPluginCapabilityManifestSchema", "catalog_hash", "plugin_id", "plugin_version",
    "request_hash", "owner_scope_hash", "trust_class", 'z.literal("completed")', "failure: z.null()"])
    if (!source.includes(required)) findings.push(finding("agent-production-runtime/contract-field",
      PATHS.contracts, `Production contract is missing ${required}.`));
  for (const forbidden of ["stage_id", "retryable", "attempt_mode", "plugin_status"])
    if (source.includes(forbidden)) findings.push(finding("agent-production-runtime/contract-state-inflation",
      PATHS.contracts, `Production contract retains forbidden state token ${forbidden}.`));
};

const inspectDependency = (source: string, findings: InspectorFinding[]): void => {
  const dependency = JSON.parse(source) as Record<string, unknown>;
  const contract = dependency.contract as Record<string, unknown> | undefined;
  const matches = contract && [dependency.version === 14, contract.version === 14,
    contract.contractId === "ai-acceptance.xuanxue-ai-production-v6",
    contract.authorityArtifact === "packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json",
    contract.generatedBy === "scripts/generate/sync-xuanxue-ai-production-v6-agent-projection.ts",
    contract.hashAlgorithm === "JCS-SHA-256", typeof contract.manifestHash === "string",
    typeof contract.manifestHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(contract.manifestHash),
    contract.providerRepo === "ADVISION-X/xuanxue-web",
    JSON.stringify(dependency.lawIds) === JSON.stringify([LAW_ID])].every(Boolean);
  if (!matches) findings.push(finding("agent-production-runtime/v14-website-dependency", PATHS.dependency,
    "AGENT must consume the generated projection of the single Website V14 contract under V25."));
};

const inspectManifestProjection = (
  transport: string, projection: string, findings: InspectorFinding[],
): void => {
  const matches = [transport.includes('from "./v6-manifest-projection.js"'),
    projection.includes("xuanxue-ai-production-v6.dependency.spec.json"),
    projection.includes("export const PRODUCTION_V6_MANIFEST_HASH"),
    !/sha256:[a-f0-9]{64}/u.test(transport),
    !transport.includes("control_manifest_hash: z.literal(PRODUCTION_V6_MANIFEST_HASH),\n  enrolled_at")]
    .every(Boolean);
  if (!matches) findings.push(finding("agent-production-runtime/generated-manifest-projection", PATHS.transport,
    "AGENT transport must consume the generated Website projection and device credentials must not own a manifest hash."));
};

const inspectEnrollmentAndHeartbeat = (
  enroll: string, worker: string, findings: InspectorFinding[],
): void => {
  const preflight = enroll.indexOf("await verifyProductionContractProjection(");
  const mutation = enroll.indexOf("await enrollProductionDevice()");
  if (preflight < 0 || mutation < 0 || preflight >= mutation || enroll.includes("projectionVerified"))
    findings.push(finding("agent-production-runtime/enrollment-contract-preflight", PATHS.enroll,
      "Cloud enrollment must verify the Website manifest projection before the first enrollment action and expose no bypass."));
  const heartbeat = worker.slice(worker.indexOf("private async performHeartbeat"),
    worker.indexOf("public async ensureFreshAttestation"));
  if (heartbeat.includes("control_manifest_hash")) findings.push(finding(
    "agent-production-runtime/heartbeat-inherits-session-contract", PATHS.worker,
    "Heartbeat must inherit the authenticated session contract and must not redeclare a manifest hash."));
};

export const inspectAgentContracts = (
  context: InspectorContext, findings: InspectorFinding[],
): void => {
  inspectContractFields(read(context, PATHS.contracts), findings);
  inspectDependency(read(context, PATHS.dependency), findings);
  inspectManifestProjection(read(context, PATHS.transport), read(context, PATHS.projection), findings);
  inspectEnrollmentAndHeartbeat(read(context, PATHS.enroll), read(context, PATHS.worker), findings);
};
