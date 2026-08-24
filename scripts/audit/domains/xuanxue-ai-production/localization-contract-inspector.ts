import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_VERSION,
  XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS,
  XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
  expectedLocalizationProviderProfile,
} from "../../../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import {
  XuanxueAiProductIdSchema,
  XuanxueAiProductionTriggerKindSchema,
} from "../../../../src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";

const root = process.cwd();
const projectionPath = path.join(
  root,
  "artifacts/contracts/localization-production-contract.v1.json",
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

const readAndAssertProjection = (): LocalizationProjection => {
  const projection = JSON.parse(readFileSync(projectionPath, "utf8")) as LocalizationProjection;
  assert.equal(
    projection.schema_version,
    XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_VERSION,
  );
  assert.equal(
    projection.contract_manifest_hash,
    XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  );
  assert.deepEqual(
    Object.keys(projection.products).sort(),
    Object.keys(XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS).sort(),
  );
  return projection;
};

const assertProjectionBindings = (projection: LocalizationProjection): void => {
  for (const [productId, contractHash] of Object.entries(
    XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
  )) {
    assert.equal(projection.products[productId], contractHash);
  }
  for (const role of [
    "candidate_a", "candidate_b", "selector_first", "selector_swap",
    "consistency", "report_translation", "article_translation",
  ] as const) {
    assert.equal(projection.roles[role], expectedLocalizationProviderProfile(role).profile_hash);
  }
  assert.deepEqual(
    XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS.localization_static_review_candidate!.roles,
    ["candidate_a", "candidate_b"],
  );
  assert.deepEqual(
    XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS.localization_static_review_selector!.roles,
    ["selector_first", "selector_swap", "consistency"],
  );
  assert.equal(
    XuanxueAiProductionTriggerKindSchema.safeParse("localization_static_review").success,
    true,
    "website-owned static review trigger must remain admissible",
  );
  assert.equal(
    XuanxueAiProductIdSchema.safeParse("localization_static_review").success,
    false,
    "legacy monolithic static review product must remain forbidden",
  );
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

export function inspectXuanxueLocalizationContract(project: Project = createAuditProject()): void {
  const projection = readAndAssertProjection();
  assertProjectionBindings(projection);
  assertRuntimeSources(project);
}

const inspectDomainEvaluation = (
  project: Project,
  context: InspectorContext,
): { findings: ReturnType<typeof createFinding>[]; evidenceRefs: readonly string[] } => {
  const findings: ReturnType<typeof createFinding>[] = [];
  try {
    inspectXuanxueLocalizationContract(project);
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
      context.planEntry.ownerInspectorPath,
      "artifacts/contracts/localization-production-contract.v1.json",
      ...criticalRuntimeFiles,
    ],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("xuanxue localization contract requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = inspectDomainEvaluation(context.project, context);
    return {
      findings: evaluation.findings,
      evidenceRefs: evaluation.evidenceRefs,
    };
  });
  return context.checks.output();
};
