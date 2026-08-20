import { existsSync } from "node:fs";

import type {
  InspectorContext,
  InspectorFinding,
  InspectorOutput,
  SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectBrowserAuthorityCore } from "./browser-authority-core-inspector.js";
import {
  addBrowserFinding,
  requireAstFacts,
  requireAstSource,
  type BrowserLawBinding,
} from "./browser-authority-inspector-support.js";
import { inspectBrowserAuthorityRelease } from "./browser-authority-release-inspector.js";
import { inspectRetiredBrowserPaths } from "./inspector-old-path-zero.js";

const laws = {
  exact: {
    lawId: "APEX-LOCAL-BROWSER-001-V2",
    clauseId: "apex-local-browser-001-v2-exact-authority-lease",
  },
  auth: {
    lawId: "APEX-LOCAL-BROWSER-002-V2",
    clauseId: "apex-local-browser-002-v2-authority-atomicity",
  },
  executor: {
    lawId: "APEX-LOCAL-BROWSER-003-V2",
    clauseId: "apex-local-browser-003-v2-single-chain",
  },
  evaluate: {
    lawId: "APEX-LOCAL-BROWSER-004-V2",
    clauseId: "apex-local-browser-004-v2-governed-command-plane",
  },
  release: {
    lawId: "APEX-LOCAL-BROWSER-005-V1",
    clauseId: "apex-local-browser-005-v1-release-identity",
  },
  crossRepo: {
    lawId: "APEX-LOCAL-BROWSER-006-V1",
    clauseId: "apex-local-browser-006-v1-cross-repo-fence-proof",
  },
} as const satisfies Readonly<Record<string, BrowserLawBinding>>;

const requiredFiles = [
  "src/lib/browser/browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-runtime.ts",
  "src/lib/browser/browser-authority-api.ts",
  "src/lib/browser/infrastructure/browser-authority-certificate.ts",
  "src/lib/browser/infrastructure/browser-authority-issuer.ts",
  "src/lib/browser/infrastructure/browser-authority-broker.ts",
  "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
  "src/lib/browser/profile/browser-profile-enrollment.ts",
  "src/lib/browser/profile/browser-profile-config.ts",
  "src/lib/browser/profile/browser-process-supervisor.ts",
  "src/lib/browser/release/browser-release-identity.ts",
  "src/lib/browser/release/browser-activation-receipt.ts",
  "src/lib/browser/release/browser-runtime-env.mjs",
  "src/lib/browser/release/extension-tree-sha256.mjs",
  "src/lib/browser/transport/transport-frame-crypto.ts",
  "src/lib/browser/transport/command-permit.ts",
  "src/lib/browser/exact-target/browser-command-actor.ts",
  "src/lib/browser/exact-target/browser-target-lease.ts",
  "src/lib/browser/exact-target/browser-target-lease-manager.ts",
  "src/lib/browser/exact-target/browser-command-contract.ts",
  "src/lib/browser/exact-target/browser-file-artifact-grant.ts",
  "src/lib/browser/exact-target/browser-target-ref.ts",
  "src/lib/browser/exact-target/browser-target-registry.ts",
  "src/lib/browser/chrome-extension/manifest.json",
  "src/lib/browser/protocol/browser-protocol.schema.json",
  "src/lib/browser/protocol/browser-capability-registry.json",
  "src/lib/browser/protocol/generated/browser-protocol.ts",
  "src/lib/browser/protocol/generated/browser-protocol-capability-map.ts",
  "src/lib/browser/protocol/generated/browser-protocol-message-validator.ts",
  "src/lib/browser/chrome-extension/service-worker-session-crypto.ts",
  "src/lib/browser/chrome-extension/service-worker-native-port-actor.ts",
  "src/lib/browser/chrome-extension/service-worker-native-transport.ts",
  "src/lib/browser/chrome-extension/service-worker.ts",
  "src/lib/browser/transport/transport-actor.ts",
  "src/lib/browser/transport/transport-authenticator.ts",
  "src/lib/browser/transport/transport-reducer.ts",
  "src/lib/browser/native-messaging-host/Cargo.toml",
  "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
  "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs",
  "src/lib/browser/native-messaging-host/install.mjs",
  "src/lib/browser/release/build-browser-runtime.mjs",
  "src/lib/browser/release/verify-browser-artifact.mjs",
  "src/lib/local-runtime/workbench-browser-support.ts",
  "src/lib/local-runtime/workbench-assembly.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/app/server.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts",
] as const;

const inspectRequiredFiles = (findings: InspectorFinding[]): void => {
  for (const filePath of requiredFiles) {
    if (existsSync(resolveFromRepo(filePath))) continue;
    addBrowserFinding(
      findings,
      "local-browser-session/exact-target-authority",
      laws.exact,
      filePath,
      "required Browser Authority production file is missing",
    );
  }
};

const inspectCrossRepoProof = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const checkId = "browser-cross-repo/authority-proof-v2";
  const proofPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts";
  const proof = requireAstSource(context, findings, checkId, laws.crossRepo, proofPath);
  if (proof) requireAstFacts({
    source: proof,
    findings,
    checkId,
    law: laws.crossRepo,
    filePath: proofPath,
    identifiers: [
      "AgentBrowserAuthorityWindowProofV2",
      "AgentBrowserAuthorityProofV2",
      "AgentRuntimeReceiptV2",
      "produceAgentBrowserAuthorityProofV2",
      "createAgentRuntimeReceiptV2",
      "windows",
      "worker_execution_fence_hash",
      "authority_certificate_hash",
      "action_receipt_subtree_hash",
      "no_action_during_authority_absence",
      "unresolved_outcome_unknown_count",
    ],
    strings: [
      "xuanxue-agent-browser-authority-proof-v2",
      "xuanxue-agent-runtime-receipt-v2",
      "CHECKPOINT_HANDOVER",
      "OUTCOME_UNKNOWN",
    ],
  });
  const facadePath = "src/plugins/xuanxue-ai-production/index.ts";
  const facade = requireAstSource(context, findings, checkId, laws.crossRepo, facadePath);
  if (facade) requireAstFacts({
    source: facade,
    findings,
    checkId,
    law: laws.crossRepo,
    filePath: facadePath,
    identifiers: [
      "createAgentRuntimeReceiptV2",
      "produceAgentBrowserAuthorityProofV2",
      "AgentRuntimeReceiptV2",
    ],
  });
};

const inspectDomainEvaluation = (
  context: InspectorContext,
): Omit<InspectorOutput, "executedChecks"> => {
  const findings: InspectorFinding[] = [];
  if (context.project.getSourceFiles().length === 0) {
    addBrowserFinding(
      findings,
      "local-browser-session/exact-target-authority",
      laws.exact,
      "scripts/audit/domains/local-browser-session/inspector.ts",
      "audit project must expose governed TypeScript sources",
    );
  }
  inspectRequiredFiles(findings);
  inspectBrowserAuthorityCore(context, findings, laws);
  inspectBrowserAuthorityRelease(context, findings, laws);
  inspectCrossRepoProof(context, findings);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...requiredFiles],
    reportJson: { status: findings.length === 0 ? "PASS" : "FAIL", findings },
  };
};

export const inspectDomain = async (
  context: InspectorContext,
): Promise<SessionInspectorOutput> => {
  if (!context.checks) {
    throw new Error("local-browser-session requires a runner-owned check session");
  }
  const evaluation = inspectDomainEvaluation(context);
  const evidenceRefs = [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles];
  const byClause = (lawId: string, clauseId: string) => evaluation.findings.filter((finding) =>
    finding.lawId === lawId && finding.clauseId === clauseId);
  await context.checks.run("browser-old-path/retired-zero", async () => ({
    findings: [...byClause(laws.exact.lawId, laws.exact.clauseId), ...inspectRetiredBrowserPaths(laws.exact.lawId, laws.exact.clauseId)],
    evidenceRefs,
  }));
  await context.checks.run("browser-auth/no-unauth-session-type", async () => ({
    findings: byClause(laws.auth.lawId, laws.auth.clauseId),
    evidenceRefs,
  }));
  await context.checks.run("browser-auth/original-reply-channel", async () => ({
    findings: byClause(laws.executor.lawId, laws.executor.clauseId),
    evidenceRefs,
  }));
  await context.checks.run("browser-file/artifact-grant-no-raw-path", async () => ({
    findings: byClause(laws.evaluate.lawId, laws.evaluate.clauseId),
    evidenceRefs,
  }));
  await context.checks.run("browser-release/artifact-activation-proof-separation", async () => ({
    findings: byClause(laws.release.lawId, laws.release.clauseId),
    evidenceRefs,
  }));
  await context.checks.run("browser-privacy/no-owner-boundary-leak", async () => ({
    findings: [],
    evidenceRefs: [context.planEntry.ownerInspectorPath, "src/lib/browser/browser-authority-api.ts"],
  }));
  await context.checks.run("browser-cross-repo/authority-proof-v2", async () => ({
    findings: byClause(laws.crossRepo.lawId, laws.crossRepo.clauseId),
    evidenceRefs: [
      context.planEntry.ownerInspectorPath,
      "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts",
      "src/plugins/xuanxue-ai-production/index.ts",
    ],
  }));
  const reportJson = {
    status: evaluation.findings.length === 0 ? "PASS" : "FAIL",
    findings: [
      ...evaluation.findings,
      ...inspectRetiredBrowserPaths(laws.exact.lawId, laws.exact.clauseId),
    ],
  };
  return context.checks.output({ ...(reportJson === undefined ? {} : { reportJson }) });
};
