import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { finalizeStaticInspection } from "../../shared/static-inspector-result.js";

const root = process.cwd();
const projectionPath = path.join(
  root,
  "src/plugins/xuanxue-ai-production/generated/xuanxue-product-execution.generated.json",
);

const criticalRuntimeFiles = [
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-schema-refinements.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-staging.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-provider-evidence.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts",
] as const;

const forbiddenLegacyIds = [
  "localization_candidate_a",
  "localization_candidate_b",
  "localization_selector_first",
  "localization_selector_swap",
  "localization_consistency",
] as const;

const hasStringLiteral = (source: SourceFile, value: string): boolean => source
  .getDescendantsOfKind(SyntaxKind.StringLiteral)
  .some((literal) => literal.getLiteralValue() === value);

const hasIdentifier = (source: SourceFile, value: string): boolean => source
  .getDescendantsOfKind(SyntaxKind.Identifier)
  .some((identifier) => astIdentifierName(identifier) === value);

const hasCall = (source: SourceFile, methodName: string): boolean => source
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((call) => {
    const expression = call.getExpression();
    return (Node.isPropertyAccessExpression(expression) && expression.getName() === methodName)
      || (Node.isIdentifier(expression) && astIdentifierName(expression) === methodName);
  });

const hasSafeParseOfRawJob = (source: SourceFile): boolean => source
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((call) => {
    const expression = call.getExpression();
    const argument = call.getArguments()[0];
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "safeParse"
      && Node.isIdentifier(argument)
      && argument.getSymbol()?.getEscapedName().toString() === "rawJob";
  });

const hasMappedSchemaParse = (source: SourceFile): boolean => source
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "map"
      && call.getArguments().some((argument) => Node.isArrowFunction(argument)
        && argument.getDescendantsOfKind(SyntaxKind.CallExpression).some((nested) => {
          const nestedExpression = nested.getExpression();
          return Node.isPropertyAccessExpression(nestedExpression)
            && nestedExpression.getName() === "parse";
        }));
  });

type LocalizationProjection = Readonly<{
  schema_version: string;
  contract_manifest_hash: string;
  products: Record<string, string>;
  roles: Record<string, string>;
}>;

type GeneratedProductProjection = Readonly<{
  localization_semantic_manifest: LocalizationProjection;
  bundle: Readonly<{
    contracts: readonly Readonly<{
      contract_id: string;
      owner_domain: string;
      product_contract_hash: string;
      product_graph: Readonly<{ nodes: readonly Readonly<{ node_id: string }>[] }>;
    }>[];
  }>;
}>;

const readAndAssertProjection = (): LocalizationProjection => {
  const generated = JSON.parse(readFileSync(projectionPath, "utf8")) as GeneratedProductProjection;
  const projection = generated.localization_semantic_manifest;
  assert.match(projection.schema_version, /^xuanxue-ai-localization-contract-manifest\.v[1-9][0-9]*$/u);
  assert.match(projection.contract_manifest_hash, /^sha256:[a-f0-9]{64}$/u);
  const contracts = generated.bundle.contracts.filter((contract) => contract.owner_domain === "localization");
  const expectedProducts = Object.fromEntries(contracts.map((contract) => [contract.contract_id, contract.product_contract_hash]));
  assert.deepEqual(projection.products, expectedProducts);
  const expectedRoles = contracts.flatMap((contract) => contract.product_graph.nodes.map((node) => node.node_id)).sort();
  assert.deepEqual(Object.keys(projection.roles).sort(), expectedRoles);
  Object.values(projection.roles).forEach((hash) => assert.match(hash, /^sha256:[a-f0-9]{64}$/u));
  return projection;
};

const assertRuntimeSources = (project: Project): void => {
  for (const relative of criticalRuntimeFiles) {
    const source = project.getSourceFile(resolveFromRepo(relative));
    assert.ok(source, `${relative} is missing from the audit project`);
    for (const legacy of forbiddenLegacyIds) {
      assert.equal(
        hasStringLiteral(source, legacy),
        false,
        `${relative} reintroduced legacy stage ${legacy}`,
      );
    }
  }
  const client = project.getSourceFile(resolveFromRepo(
    "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts",
  ));
  assert.ok(client);
  assert.equal(hasSafeParseOfRawJob(client), true);
  assert.equal(hasCall(client, "reportUnaddressableClaim"), true);
  assert.equal(hasCall(client, "nackMalformedClaim"), false);
  assert.equal(hasMappedSchemaParse(client), false);
  const worker = project.getSourceFile(resolveFromRepo(
    "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts",
  ));
  assert.ok(worker);
  assert.equal(hasIdentifier(worker, "sessionHeartbeatLoop"), true);
  assert.equal(hasCall(worker, "heartbeat"), true);
  const providerEvidence = project.getSourceFile(resolveFromRepo(
    "src/plugins/xuanxue-ai-production/xuanxue-ai-production-provider-evidence.ts",
  ));
  assert.ok(providerEvidence);
  assert.equal(hasCall(providerEvidence, "localizationProviderEvidenceFailure"), true);
  assert.equal(hasIdentifier(providerEvidence, "providerTranscriptHash"), true);
};

export async function inspectXuanxueLocalizationContract(project: Project = createAuditProject()): Promise<void> {
  readAndAssertProjection();
  assertRuntimeSources(project);
}

const inspectDomainEvaluation = async (
  project: Project,
  context: InspectorContext,
): Promise<{ findings: ReturnType<typeof createFinding>[]; evidenceRefs: readonly string[] }> => {
  const findings: ReturnType<typeof createFinding>[] = [];
  try {
    await inspectXuanxueLocalizationContract(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const binding of context.planEntry.bindings) {
      findings.push(createFinding({
        lawId: binding.lawId,
        clauseId: binding.clauseId,
        checkId: `${context.planEntry.capabilityDomain}/owner-assertion-set`,
        filePath: context.planEntry.ownerInspectorPath,
        message: `Localization contract assertion failed: ${message.slice(0, 240)}`,
      }));
    }
  }
  return {
    findings,
    evidenceRefs: [
      "src/plugins/xuanxue-ai-production/generated/xuanxue-product-execution.generated.json",
      ...criticalRuntimeFiles,
    ].filter((path) => context.targetPaths.includes(path)),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context.project, context);
  return finalizeStaticInspection(context, {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: evaluation.findings,
    inspectedFiles: [...evaluation.evidenceRefs],
  }, ["LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V3"]);
};
