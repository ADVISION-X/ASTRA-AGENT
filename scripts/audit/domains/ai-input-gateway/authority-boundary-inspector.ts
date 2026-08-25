import type { InspectorContext } from "../../shared/inspector-contracts.js";
import {
  type AiInputGatewayFinding as Finding,
  identifiers,
  propertyNames,
  pushAiInputGatewayFinding as pushFinding,
  requireAiInputGatewaySource as requireSourceFile,
  typePropertyNames,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

export const inspectBoundedChoiceJudge = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const schema = requireSourceFile(context, findings, lawId, P.attachment.schemaPath);
  const contract = requireSourceFile(context, findings, lawId, P.attachment.contractPath);
  if (!schema || !contract) return;
  const inputInitializer = schema.getVariableDeclaration("AiFeedInputSchema")?.getInitializer();
  const publicInputProperties = inputInitializer ? propertyNames(inputInitializer) : new Set<string>();
  const executeOptions = typePropertyNames(contract, "AiInputGatewayExecuteOptions");
  for (const required of ["promptContractId", "expectedOutputSchemaRef", "requestedBy"]) {
    if (!publicInputProperties.has(required)) {
      pushFinding(findings, lawId, P.attachment.schemaPath, "ai-input-gateway/bounded-choice-judge", `The bounded judge request must bind caller-owned ${required}.`);
    }
  }
  const forbiddenControls = [
    "workflow", "workflowPlan", "nextAction", "browserAction", "pageAction", "selector", "coordinate",
    "paymentAction", "refundAction", "deleteAction", "sensitiveSubmission",
  ];
  for (const forbidden of forbiddenControls) {
    if (publicInputProperties.has(forbidden) || executeOptions.has(forbidden)) {
      pushFinding(findings, lawId, P.attachment.contractPath, "ai-input-gateway/bounded-choice-judge", `The AI request boundary must not expose ${forbidden}; callers retain workflow, Browser and sensitive-action authority.`);
    }
  }
  if (!executeOptions.has("browser") || !executeOptions.has("onPageActionCommitted")) {
    pushFinding(findings, lawId, P.attachment.contractPath, "ai-input-gateway/bounded-choice-judge", "Provider transport must receive a caller-owned Browser lease and report committed page actions instead of creating its own authority.");
  }
};

export const inspectCallerApprovedInputReferences = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const schema = requireSourceFile(context, findings, lawId, P.attachment.schemaPath);
  const packagePath = "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts";
  const packageRuntime = requireSourceFile(context, findings, lawId, packagePath);
  const adapter = requireSourceFile(context, findings, lawId, P.attachment.adapterContractPath);
  if (!schema || !packageRuntime || !adapter) return;
  const inputInitializer = schema.getVariableDeclaration("AiFeedInputSchema")?.getInitializer();
  const inputProperties = inputInitializer ? propertyNames(inputInitializer) : new Set<string>();
  if (!inputProperties.has("inputRefs")
    || !identifiers(packageRuntime).has("inputRefIds")
    || !identifiers(packageRuntime).has("assertResumedAttachmentIdentity")
    || !identifiers(adapter).has("inputRefId")) {
    pushFinding(findings, lawId, packagePath, "ai-input-gateway/caller-approved-input-refs", "Every transported input must preserve the caller-approved inputRef identity through packaging, resume validation and provider proof.");
  }
  const forbiddenAuthority = new Set([
    "readdir", "readdirSync", "glob", "globSync", "walk", "discoverFiles", "chooseFile", "selectFile",
    "pay", "payment", "refund", "delete", "remove", "sensitiveSubmission",
  ]);
  for (const [repoPath, source] of [
    [P.attachment.schemaPath, schema],
    [P.attachment.adapterContractPath, adapter],
    [packagePath, packageRuntime],
  ] as const) {
    const leaked = [...identifiers(source)].find((name) => forbiddenAuthority.has(name));
    if (leaked) {
      pushFinding(findings, lawId, repoPath, "ai-input-gateway/caller-approved-input-refs", `AI transport must not discover files or own sensitive final actions; forbidden authority symbol: ${leaked}.`);
    }
  }
};
