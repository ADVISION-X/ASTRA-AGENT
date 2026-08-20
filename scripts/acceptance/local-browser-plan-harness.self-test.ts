import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Project } from "ts-morph";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const planPath = path.join(repoRoot, "docs/项目方案/AGENT-插件生产级实施方案.md");
const browserRoot = "src/lib/browser/";

type WorkOrder = Readonly<{
  readonly work_order_id: string;
  readonly depends_on?: readonly string[];
  readonly create_scope?: readonly string[];
  readonly retire_or_delete_scope?: readonly string[];
}>;

export type ExecutionManifest = Readonly<{
  readonly candidate_id: string;
  readonly decision_gates: readonly Readonly<{ readonly decision_gate_id: string }> [];
  readonly work_orders: readonly WorkOrder[];
}>;

export type BrowserConsumer = Readonly<{
  readonly consumerId: string;
  readonly sourcePath: string;
  readonly owner: string;
  readonly migrationWorkOrders: readonly string[];
  readonly acceptanceIds: readonly string[];
}>;

const browserConsumers = [
  ["CON-001", "src/lib/local-runtime/workbench-browser-support.ts", "local-runtime", ["WO-023"], ["ACC-023"]],
  ["CON-002", "src/lib/local-runtime/workbench-video-download-support.ts", "local-runtime", ["WO-023", "WO-026"], ["ACC-023", "ACC-026"]],
  ["CON-003", "src/lib/local-runtime/workbench-ai-gateway-support.ts", "local-runtime", ["WO-023", "WO-025"], ["ACC-023", "ACC-025"]],
  ["CON-004", "src/lib/local-runtime/workbench-assembly.ts", "local-runtime", ["WO-023"], ["ACC-023"]],
  ["CON-005", "src/capabilities/dom-automation/runtime/dom-target-binding.ts", "dom-automation", ["WO-024"], ["ACC-024"]],
  ["CON-006", "src/capabilities/ai-input-gateway/ability-group.ts", "ai-input-gateway", ["WO-025"], ["ACC-025"]],
  ["CON-007", "src/capabilities/video-download/children/download-web-video-once.ts", "video-download", ["WO-026"], ["ACC-026"]],
  ["CON-008", "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts", "amazon-invoice-upload", ["WO-027"], ["ACC-027"]],
  ["CON-009", "src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts", "amazon-product-mining", ["WO-028"], ["ACC-028"]],
  ["CON-010", "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts", "xuanxue-ai-production", ["WO-029"], ["ACC-029"]],
  ["CON-011", "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts", "acceptance", ["WO-034"], ["ACC-034"]],
] as const satisfies ReadonlyArray<readonly [string, string, string, readonly string[], readonly string[]]>;

export const CONSUMERS: readonly BrowserConsumer[] = browserConsumers.map(([
  consumerId,
  sourcePath,
  owner,
  migrationWorkOrders,
  acceptanceIds,
]) => ({ consumerId, sourcePath, owner, migrationWorkOrders, acceptanceIds }));

export const parseArguments = (argv: readonly string[]): ReadonlyMap<string, string | true> => {
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      parsed.set(token, value);
      index += 1;
      continue;
    }
    parsed.set(token, true);
  }
  return parsed;
};

export const readExecutionManifest = (): ExecutionManifest => {
  const source = readFileSync(planPath, "utf8");
  const match = source.match(/```execution-manifest\n([\s\S]*?)\n```/u);
  assert.ok(match?.[1], "The implementation plan must contain one execution-manifest JSON block.");
  const manifest = JSON.parse(match[1]) as ExecutionManifest;
  assert.equal(typeof manifest.candidate_id, "string", "Execution manifest candidate_id is required.");
  assert.ok(Array.isArray(manifest.work_orders), "Execution manifest work_orders are required.");
  assert.ok(Array.isArray(manifest.decision_gates), "Execution manifest decision_gates are required.");
  return manifest;
};

export const resolveDeliverable = (uri: string): string => {
  assert.ok(uri.startsWith("deliverable://"), `Expected deliverable URI, received ${uri}.`);
  const segments = uri.slice("deliverable://".length).split("/");
  assert.ok(segments.length > 0 && segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".."), `Unsafe deliverable URI: ${uri}`);
  const root = path.resolve(process.env.GRASSEYE_DELIVERABLES_DIR?.trim() || ".grasseye-local/deliverables");
  const resolved = path.resolve(root, ...segments);
  assert.ok(resolved.startsWith(`${root}${path.sep}`), `Deliverable escapes its root: ${uri}`);
  return resolved;
};

export const writeJson = (uri: string, value: unknown): string => {
  const outputPath = resolveDeliverable(uri);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  return outputPath;
};

export const readJson = <T,>(uri: string): T => {
  const inputPath = resolveDeliverable(uri);
  assert.ok(existsSync(inputPath), `Required deliverable is missing: ${uri}`);
  return JSON.parse(readFileSync(inputPath, "utf8")) as T;
};

export const currentCandidate = (): string => execFileSync(
  "git",
  ["rev-parse", "HEAD"],
  { cwd: repoRoot, encoding: "utf8" },
).trim();

export const trackedBrowserFiles = (candidate = currentCandidate()): readonly string[] => execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", candidate, "--", "src/lib/browser"],
  { cwd: repoRoot, encoding: "utf8" },
).split("\n").filter((filePath) => filePath.startsWith(browserRoot)).sort();

const project = (): Project => new Project({ tsConfigFilePath: path.join(repoRoot, "tsconfig.json") });

const toRepoPath = (filePath: string): string => path.relative(repoRoot, filePath).split(path.sep).join("/");

export const browserImportsFor = (sourcePath: string): readonly string[] => {
  const sourceFile = project().getSourceFile(path.join(repoRoot, sourcePath));
  assert.ok(sourceFile, `Consumer source must exist before cutover: ${sourcePath}`);
  return sourceFile.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierSourceFile())
    .filter((target): target is NonNullable<typeof target> => target !== undefined)
    .map((target) => toRepoPath(target.getFilePath()))
    .filter((target) => target.startsWith(browserRoot))
    .sort();
};

export const buildConsumerRegistry = (candidate = currentCandidate()) => ({
  schemaVersion: "browser-retirement-consumer-registry.v1",
  candidate,
  consumers: CONSUMERS.map((consumer) => ({
    ...consumer,
    browserImports: browserImportsFor(consumer.sourcePath),
    constructionStatus: "BLOCKED" as const,
  })),
});

export const buildFileClassification = (candidate = currentCandidate()) => {
  const sourceProject = project();
  const consumersByBrowserPath = new Map<string, string[]>();
  for (const sourceFile of sourceProject.getSourceFiles()) {
    const sourcePath = toRepoPath(sourceFile.getFilePath());
    for (const declaration of sourceFile.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierSourceFile();
      if (!target) continue;
      const targetPath = toRepoPath(target.getFilePath());
      if (!targetPath.startsWith(browserRoot)) continue;
      consumersByBrowserPath.set(targetPath, [...(consumersByBrowserPath.get(targetPath) ?? []), sourcePath]);
    }
  }
  const files = trackedBrowserFiles(candidate).map((filePath) => ({
    filePath,
    classification: "DELETE" as const,
    reason: "The greenfield plan retires every baseline Browser implementation file before terminal reconstruction.",
    importConsumers: [...new Set(consumersByBrowserPath.get(filePath) ?? [])].sort(),
  }));
  assert.ok(files.length > 0, "Baseline Browser tree must not be empty.");
  return {
    schemaVersion: "browser-retirement-file-classification.v1",
    candidate,
    deleteTargets: files,
    unclassifiedPaths: [] as readonly string[],
  };
};

export const assertPlanShape = (manifest: ExecutionManifest): void => {
  const expectedWorkOrders = ["WO-002", "WO-005", "WO-006", "WO-007", "WO-008", "WO-009", "WO-010", "WO-011", "WO-012", "WO-060"];
  const workOrderIds = manifest.work_orders.map((workOrder) => workOrder.work_order_id);
  assert.equal(workOrderIds.length, 58, "The plan must retain every one of its 58 work orders.");
  assert.equal(new Set(workOrderIds).size, workOrderIds.length, "Work-order IDs must be unique.");
  for (const workOrderId of expectedWorkOrders) {
    assert.ok(workOrderIds.includes(workOrderId), `Missing required work order ${workOrderId}.`);
  }
  assert.deepEqual(
    manifest.decision_gates.map((gate) => gate.decision_gate_id),
    ["DG-001", "DG-002", "DG-003", "DG-004", "DG-005", "DG-006", "DG-007"],
    "Decision gates must be complete and ordered.",
  );
  const demolition = manifest.work_orders.find((workOrder) => workOrder.work_order_id === "WO-009");
  assert.ok(demolition?.retire_or_delete_scope?.includes("deliverable://browser-retirement/file-classification.json#delete_targets"));
};

const isDirectExecution = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  const manifest = readExecutionManifest();
  assertPlanShape(manifest);
  if (parseArguments(process.argv.slice(2)).has("--expect-all-negative-cases-rejected")) {
    assert.throws(() => resolveDeliverable("deliverable://browser-retirement/../escape.json"));
    assert.throws(() => resolveDeliverable("not-a-deliverable"));
    assert.throws(() => JSON.parse("{invalid"));
  }
  process.stdout.write("local-browser-plan-harness-self-test-ok\n");
}
