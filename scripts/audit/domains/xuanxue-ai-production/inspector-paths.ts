export const authorityPaths = [
  ".github/instructions/agent-rules/modules/module-xuanxue-ai-production.instructions.md",
  "docs/法案辅助文件/GrassEye 玄学 AI 生产工厂施工图.md",
  "scripts/audit/domains/xuanxue-ai-production/manifest.json",
] as const;

export const schemaPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.ts";
export const profilePath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.ts";
export const storePath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production.store.ts";
export const schedulerPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production.scheduler.ts";
export const flowPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production.flow.ts";
export const cloudContractPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.ts";
export const cloudCredentialPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-credential.ts";
export const cloudWorkerPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts";
export const gatewayExecutionStatePath = "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts";
export const gatewayCanonicalRoutingPath = "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts";
export const gatewayExecutionProfilePath = "src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts";
export const gatewayConversationTitlePath = "src/capabilities/ai-input-gateway/providers/gpt-web-conversation-title.ts";
export const acceptancePath = "scripts/acceptance/xuanxue-ai-production.acceptance.ts";

export const acceptanceSupportPaths = [
  "scripts/acceptance/xuanxue-ai-production-fixture.ts",
  "scripts/acceptance/xuanxue-ai-production-fixture-faults.ts",
  "scripts/acceptance/xuanxue-ai-production-hehun-join-guards.ts",
  "scripts/acceptance/xuanxue-ai-production-order-graph-acceptance.ts",
  "scripts/acceptance/xuanxue-ai-production-order-graph-assertions.ts",
  "scripts/acceptance/xuanxue-ai-production-naming-join-guards.ts",
  "scripts/acceptance/xuanxue-ai-production-parent-recovery.ts",
  "scripts/acceptance/xuanxue-ai-production-parent-rebuild-acceptance.ts",
  "scripts/acceptance/xuanxue-ai-production-restart-recovery.ts",
] as const;

export const removedSecondChainPaths = [
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-provider-input-preflight.ts",
  "scripts/acceptance/xuanxue-ai-production-provider-preflight.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-model-identity.ts",
] as const;

export const pluginPaths = [
  "src/plugins/xuanxue-ai-production/index.ts", schemaPath, profilePath, storePath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-intervention.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.workbench-owner.ts",
  "src/app/workbench-xuanxue-ai-production-routes.ts",
  "src/app/workbench-xuanxue-ai-production-client.ts",
  "src/app/workbench-api-boundary.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-seeded-proof.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-conversation-policy.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-database.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-orders.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-checkpoint-proof.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-cloud-recovery.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-conversation-rebuild.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-event.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-recovery.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-conversation-graph-recovery.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-output-recovery.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.runtime.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts",
  flowPath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-output-integrity.ts",
  schedulerPath,
  cloudContractPath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts",
  cloudCredentialPath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-staging.ts",
  cloudWorkerPath,
  "src/mediator/xuanxue-ai-production-route.ts",
  "scripts/startup/xuanxue-ai-production-cloud-enroll.ts",
  gatewayExecutionStatePath,
  gatewayCanonicalRoutingPath,
  gatewayExecutionProfilePath,
  gatewayConversationTitlePath,
  acceptancePath,
  ...acceptanceSupportPaths,
] as const;
