import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V28";
const PATHS = {
  contracts: "src/lib/local-runtime/production/contracts.ts",
  transport: "src/lib/local-runtime/production/transport-protocol.ts",
  credential: "src/lib/local-runtime/production/credential.ts",
  cloud: "src/lib/local-runtime/production/cloud-client.ts",
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
    contract.providerRepo === "ADVISION-X/xuanxue-web",
    JSON.stringify(Object.keys(contract).sort()) === JSON.stringify(["contractId", "providerRepo", "version"]),
    JSON.stringify(dependency.lawIds) === JSON.stringify([LAW_ID])].every(Boolean);
  if (!matches) findings.push(finding("agent-production-runtime/v14-website-dependency", PATHS.dependency,
    "AGENT must consume the generated projection of the single Website V14 contract under V27."));
};

const inspectManifestDelivery = (
  transport: string, credential: string, worker: string, cloud: string,
  findings: InspectorFinding[],
): void => {
  const matches = [transport.includes("control_manifest_hash: hash"),
    credential.includes("control_manifest_hash: z.string().regex"),
    credential.includes("control_manifest_hash: controlManifestHash"),
    worker.includes("control_manifest_hash: this.device.control_manifest_hash"),
    cloud.includes("job.grant.control_contract_manifest_hash !== session.device.control_manifest_hash"),
    !transport.includes("PRODUCTION_V6_MANIFEST_HASH")]
    .every(Boolean);
  if (!matches) findings.push(finding("agent-production-runtime/live-manifest-delivery", PATHS.transport,
    "Website enrollment must deliver the live manifest identity into the device credential and every claim must match it."));
};

const inspectEnrollmentAndHeartbeat = (
  enroll: string, worker: string, findings: InspectorFinding[],
): void => {
  const preflight = enroll.indexOf("await verifyProductionDependency(");
  const mutation = enroll.indexOf("await enrollProductionDevice()");
  if (preflight < 0 || mutation < 0 || preflight >= mutation || enroll.includes("projectionVerified"))
    findings.push(finding("agent-production-runtime/enrollment-contract-preflight", PATHS.enroll,
      "Cloud enrollment must verify the minimal dependency before the first enrollment action and expose no bypass."));
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
  const worker = read(context, PATHS.worker);
  inspectManifestDelivery(
    read(context, PATHS.transport), read(context, PATHS.credential), worker,
    read(context, PATHS.cloud), findings,
  );
  inspectEnrollmentAndHeartbeat(read(context, PATHS.enroll), worker, findings);
};
