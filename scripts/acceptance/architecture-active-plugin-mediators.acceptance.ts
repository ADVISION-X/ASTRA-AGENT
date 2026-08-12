import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { inspectDomain } from "../audit/domains/architecture-boundary/inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import { createAuditProject } from "../audit/shared/project.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const marker = "__architecture_mediator_acceptance__";
const pluginRoot = `src/plugins/${marker}`;
const mediatorPath = `src/mediator/${marker}-route.ts`;
const duplicateMediatorPath = `src/mediator/${marker}-shadow-route.ts`;
const bypassPath = `src/lib/local-runtime/${marker}-bypass.ts`;
const typesPath = `src/types/${marker}-runtime.ts`;
const statusPath = "scripts/audit/config/plugin-status.json";
const originalStatus = readFileSync(resolveFromRepo(statusPath), "utf8");

const writeFixture = (repoPath: string, content: string): void => {
  const absolutePath = resolveFromRepo(repoPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
};

const writeStatus = (): void => {
  const parsed = JSON.parse(originalStatus) as { plugins: unknown[] };
  parsed.plugins.push({
    pluginId: marker,
    status: "active",
    owner: `plugin:${marker}`,
    phase: "acceptance-fixture",
    mediatorRoute: mediatorPath,
    mediatorBindings: [{
      routeExport: "runFixtureRoute",
      schemaExport: "FixtureInputSchema",
      taskExport: "startFixtureTask",
    }],
    allowedEntrypoints: [mediatorPath, bypassPath],
    allowedAcceptanceTests: ["acceptance:lottery-ticket-plan"],
    allowedNpmScripts: ["acceptance:lottery-ticket-plan"],
    exposureTokens: [marker],
    lawSourceRefs: [".github/instructions/agent-rules/modules/module-architecture-boundary.instructions.md"],
  });
  writeFileSync(resolveFromRepo(statusPath), `${JSON.stringify(parsed, null, 2)}\n`);
};

const runInspector = async () => {
  const project = createAuditProject();
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === "architecture-boundary");
  if (!planEntry) throw new Error("architecture-boundary plan entry is missing");
  const controller = createInspectorCheckSession(planEntry);
  return inspectDomain({
    checks: controller.checks,
    completedReports: {},
    generatedPlan: [],
    planEntry,
    project,
  });
};

writeFixture(`${pluginRoot}/schema.ts`, `import { z } from "zod";\nexport const FixtureInputSchema = z.object({ value: z.string() }).strict();\n`);
writeFixture(`${pluginRoot}/flow.ts`, `export const startFixtureTask = (input: { value: string }) => input.value;\nexport const resumeFixtureTask = (input: { value: string }) => input.value;\n`);
writeFixture(`${pluginRoot}/index.ts`, `export { FixtureInputSchema } from "./schema.js";\nexport { resumeFixtureTask, startFixtureTask } from "./flow.js";\n`);
writeStatus();

try {
  const missingRoute = await runInspector();
  assert.equal(
    missingRoute.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-missing"
      && finding.filePath === mediatorPath),
    true,
    "an active plugin without its canonical mediator route must fail",
  );

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";\nexport const runFixtureRoute = (rawInput: unknown) => startFixtureTask(FixtureInputSchema.parse(rawInput));\n`);
  writeFixture(bypassPath, `import { startFixtureTask } from "../../plugins/${marker}/index.js";\nexport const bypassFixtureMediator = () => startFixtureTask({ value: "bypass" });\n`);
  const bypass = await runInspector();
  assert.equal(
    bypass.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-bypass"
      && finding.filePath === bypassPath),
    true,
    "a Local Runtime direct call to the mediated task entry must fail",
  );

  writeFixture(bypassPath, `import { resumeFixtureTask } from "../../plugins/${marker}/index.js";
export const resumeFixtureTaskFromWorkbench = (rawInput: { value: string }) => resumeFixtureTask(rawInput);
`);
  const unregisteredResume = await runInspector();
  assert.equal(
    unregisteredResume.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-unregistered-intake"
      && finding.filePath === bypassPath),
    true,
    "an unregistered lifecycle task intake must fail even when mediatorBindings omits its task symbol",
  );

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";
const decoySchema = { parse: (value: unknown) => value };
export const runFixtureRoute = (rawInput: unknown) => startFixtureTask(decoySchema.parse(rawInput) as { value: string });
void FixtureInputSchema;
`);
  const decoySchema = await runInspector();
  assert.equal(
    decoySchema.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-binding-inexact"
      && finding.filePath === mediatorPath),
    true,
    "an unrelated parse method must not impersonate the owning job schema",
  );

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";
export const runFixtureRoute = (rawInput: unknown) => {
  const state = new Map<string, string>();
  state.set("owner", "mediator");
  return startFixtureTask(FixtureInputSchema.parse(rawInput));
};
`);
  const mediatorState = await runInspector();
  assert.equal(
    mediatorState.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-state-or-action"
      && finding.filePath === mediatorPath),
    true,
    "mediator-owned state or extra actions must fail",
  );

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";
export const runFixtureRoute = (rawInput: unknown) => startFixtureTask(FixtureInputSchema.parse(rawInput));
`);
  writeFixture(duplicateMediatorPath, `import { startFixtureTask } from "../plugins/${marker}/index.js";
export const runDuplicateRoute = () => startFixtureTask({ value: "duplicate" });
`);
  const duplicateRoute = await runInspector();
  assert.equal(
    duplicateRoute.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-duplicate"
      && finding.filePath === duplicateMediatorPath),
    true,
    "a second mediator route for the same plugin must fail",
  );
  rmSync(resolveFromRepo(duplicateMediatorPath), { force: true });

  writeFixture(duplicateMediatorPath, `export { runFixtureRoute as runShadowRoute } from "./${marker}-route.js";\n`);
  const reexportRoute = await runInspector();
  assert.equal(
    reexportRoute.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-duplicate"
      && finding.filePath === duplicateMediatorPath),
    true,
    "a re-export-only second mediator file must fail",
  );
  rmSync(resolveFromRepo(duplicateMediatorPath), { force: true });

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";
export const runFixtureRoute = (rawInput: unknown) => {
  if (rawInput === null) return null;
  return startFixtureTask(FixtureInputSchema.parse(rawInput));
};
`);
  const earlyReturn = await runInspector();
  assert.equal(
    earlyReturn.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-state-or-action"
      && finding.filePath === mediatorPath),
    true,
    "a mediator early-return path that skips parse and task must fail",
  );

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";
export const runFixtureRoute = (rawInput: unknown) => {
  try {
    return startFixtureTask(FixtureInputSchema.parse(rawInput));
  } catch {
    return null;
  }
};
`);
  const swallowedFailure = await runInspector();
  assert.equal(
    swallowedFailure.findings.some((finding) =>
      finding.checkId === "architecture/active-plugin-mediator-state-or-action"
      && finding.filePath === mediatorPath),
    true,
    "a mediator path that swallows parse or task failure must fail",
  );

  writeFixture(mediatorPath, `import { FixtureInputSchema, startFixtureTask } from "../plugins/${marker}/index.js";
export const runFixtureRoute = (rawInput: unknown) => startFixtureTask(FixtureInputSchema.parse(rawInput));
`);

  writeFixture(typesPath, `export const forbiddenRuntimeFunction = (): string => "runtime";\n`);
  const typesRuntime = await runInspector();
  assert.equal(
    typesRuntime.findings.some((finding) =>
      finding.checkId === "architecture/types-contract-runtime-logic"
      && finding.filePath === typesPath),
    true,
    "runtime behavior under src/types must fail",
  );

  writeFixture(typesPath, `import { readFileSync } from "node:fs";
export const forbiddenIo = readFileSync("/tmp/forbidden", "utf8");
`);
  const typesIo = await runInspector();
  assert.equal(
    typesIo.findings.some((finding) =>
      finding.checkId === "architecture/types-contract-runtime-logic"
      && finding.filePath === typesPath),
    true,
    "I/O hidden in a src/types variable initializer must fail",
  );

  writeFixture(typesPath, `declare const runtime: { execute(): string };
export const forbiddenRuntimeCall = runtime.execute();
`);
  const localRuntimeCall = await runInspector();
  assert.equal(
    localRuntimeCall.findings.some((finding) =>
      finding.checkId === "architecture/types-contract-runtime-logic"
      && finding.filePath === typesPath),
    true,
    "a local runtime call under src/types must fail",
  );

  writeFixture(typesPath, `import "../lib/ids.js";\nexport type FixtureType = string;\n`);
  const sideEffectImport = await runInspector();
  assert.equal(
    sideEffectImport.findings.some((finding) =>
      finding.checkId === "architecture/types-contract-runtime-logic"
      && finding.filePath === typesPath),
    true,
    "a relative side-effect import under src/types must fail",
  );

  process.stdout.write("architecture-active-plugin-mediators-acceptance-ok\n");
} finally {
  writeFileSync(resolveFromRepo(statusPath), originalStatus);
  rmSync(resolveFromRepo(pluginRoot), { force: true, recursive: true });
  rmSync(resolveFromRepo(mediatorPath), { force: true });
  rmSync(resolveFromRepo(duplicateMediatorPath), { force: true });
  rmSync(resolveFromRepo(bypassPath), { force: true });
  rmSync(resolveFromRepo(typesPath), { force: true });
}
