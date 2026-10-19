import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ModuleKind, ModuleResolutionKind, Project, ScriptTarget } from "ts-morph";

import { resolveFromRepo } from "../../scripts/audit/shared/paths.js";
import { inspectProductAcceptanceBoundaries } from "../../scripts/audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { collectCodePurityGovernedFiles } from "../../scripts/audit/domains/code-purity/components/code-purity-governed-files.js";
import { scanZombieSurfaces } from "../../scripts/audit/domains/code-purity/components/scan-zombie-surfaces.js";
import { requiresProductionConsumer } from "../../scripts/audit/domains/code-purity/components/scan-zombie-reference-surfaces.js";
import { createInspectorContextFixture } from "../../scripts/audit/shared/inspector-context-acceptance-support.js";

const sourceProject = (sources: Record<string, string>): Project => {
  const project = new Project({ useInMemoryFileSystem: true,
    compilerOptions: { module: ModuleKind.ESNext, moduleResolution: ModuleResolutionKind.Bundler, target: ScriptTarget.ES2022 } });
  for (const [path, source] of Object.entries(sources)) project.createSourceFile(resolveFromRepo(path), source);
  return project;
};

test("Code Purity has no retired generated-plan or ci-full self-proof exception", () => {
  const antiEvasion = readFileSync(resolveFromRepo(
    "scripts/audit/domains/code-purity/components/zombie-anti-evasion.ts"), "utf8");
  const phaseRunner = readFileSync(resolveFromRepo(
    "scripts/audit/domains/code-purity/components/code-purity-phase-runner.ts"), "utf8");
  assert.doesNotMatch(antiEvasion, /run-generated-plan|ci-full|isGeneratedPlanOwnerImportContract/u);
  assert.doesNotMatch(phaseRunner, /scan-code-purity-no-regex/u);
});

test("a Product acceptance needs no standalone self-name literal and retains foreign-identity protection", () => {
  const sources = {
    "src/mediator/product-plugin-catalog.ts": "import { alpha } from '../plugins/alpha/index.js'; import { beta } from '../plugins/beta/index.js'; export const catalog = [alpha, beta];",
    "src/plugins/alpha/index.ts": "export const alpha = { pluginId: 'alpha' };",
    "src/plugins/beta/index.ts": "export const beta = { pluginId: 'beta' };",
  };
  const inspect = (body: string) => {
    const project = sourceProject({ ...sources, "scripts/acceptance/product-plugins/alpha.acceptance.ts": body });
    const findings: Parameters<typeof inspectProductAcceptanceBoundaries>[0]["findings"] = [];
    inspectProductAcceptanceBoundaries({ project, lawId: "LAW-ARCHITECTURE-BOUNDARY-001-V18", findings, inspectedFiles: new Set() });
    return findings.map((finding) => finding.checkId);
  };
  assert.deepEqual(inspect("import { alpha } from '../../../src/plugins/alpha/index.js'; console.log(alpha.pluginId);"), []);
  assert.ok(inspect("import { beta } from '../../../src/plugins/beta/index.js'; console.log(beta.pluginId);")
    .includes("architecture/product-acceptance-cross-plugin-import"));
  assert.ok(inspect("const selected = 'beta'; console.log(selected);")
    .includes("architecture/product-acceptance-identity-drift"));
});

const inspectBagScope = (input: {
  production: string;
  verification: string;
  unreachable?: string;
  tool?: boolean;
}) => {
  const subjectPath = input.tool ? "scripts/audit/scope-subject.ts" : "src/scope-subject.ts";
  const project = sourceProject({
    [subjectPath]: "export interface Shape { live: () => string; other: () => string; } export const subject: Shape = { live: () => 'live', other: () => 'other' };",
    "src/scope-main.ts": `import { subject } from '../${subjectPath.replace(/\.ts$/u, ".js")}'; ${input.production}`,
    "scripts/acceptance/scope-check.ts": `import { subject, type Shape } from '../../${subjectPath.replace(/\.ts$/u, ".js")}'; ${input.verification}`,
    "src/scope-unreachable.ts": `import { subject, type Shape } from '../${subjectPath.replace(/\.ts$/u, ".js")}'; ${input.unreachable ?? ""}`,
  });
  const laws = ["LAW-CODE-PURITY-001-V6", "LAW-CODE-PURITY-002-V2", "LAW-CODE-PURITY-003-V3"];
  const result = scanZombieSurfaces(createInspectorContextFixture(project, "code-purity", laws),
    collectCodePurityGovernedFiles(project), laws, { packageScripts: {
      start: "node src/scope-main.ts", test: "node scripts/acceptance/scope-check.ts",
    } });
  assert.equal(requiresProductionConsumer(subjectPath), !input.tool);
  assert.ok(result.summary.liveEntryPoints.some((entry) => entry.filePath === "src/scope-main.ts" && entry.consumerScope === "production"));
  assert.ok(result.summary.liveEntryPoints.some((entry) => entry.filePath === "scripts/acceptance/scope-check.ts" && entry.consumerScope === "verification"));
  return result.findings.filter((finding) => finding.filePath === subjectPath);
};

test("production bag proofs ignore verification and unreachable references in both directions", () => {
  const verification = "const copy = { ...subject }; const read = (value: Shape) => value.other(); console.log(read(subject), copy.other());";
  assert.deepEqual(inspectBagScope({ production: "console.log(subject.live(), subject.other());", verification }), []);
  for (const remaining of [
    { verification, unreachable: "" },
    { verification: "console.log(subject.live());", unreachable: "const read = (value: Shape) => value.other(); console.log(read(subject));" },
  ]) {
    const findings = inspectBagScope({ production: "console.log(subject.live());", ...remaining });
    assert.ok(findings.some((finding) => finding.checkId === "code-purity/object-bag-unused-property" && finding.message.includes("other")));
  }
  const onlyVerification = inspectBagScope({ production: "", verification: "console.log(subject.live(), subject.other());" });
  assert.ok(onlyVerification.some((finding) => finding.checkId === "code-purity/zombie-export"));
  const dynamic = inspectBagScope({ production: "const key = Math.random() > 0 ? 'live' : 'other'; console.log(subject[key]());", verification });
  assert.ok(dynamic.some((finding) => finding.checkId === "code-purity/object-bag-dynamic-usage"));
});

test("indirect bag proofs keep the same consumer scope and verification tools remain governed", () => {
  const array = inspectBagScope({
    production: "export const rows = [subject]; for (const row of rows) console.log(row.live());",
    verification: "import { rows } from '../../src/scope-main.js'; for (const row of rows) console.log(row.other());",
  });
  assert.ok(array.some((finding) => finding.checkId === "code-purity/object-bag-unused-property" && finding.message.includes("other")));
  const typed = inspectBagScope({
    production: "export const registry = { ...subject } satisfies Record<'live' | 'other', () => string>;",
    verification: "import { registry } from '../../src/scope-main.js'; const key: 'live' | 'other' = 'other'; console.log(registry[key]());",
  });
  assert.ok(typed.some((finding) => finding.checkId === "code-purity/object-bag-dynamic-usage"));
  assert.deepEqual(inspectBagScope({ tool: true, production: "", verification: "console.log(subject.live(), subject.other());" }), []);
  assert.ok(inspectBagScope({ tool: true, production: "", verification: "console.log(subject.live());" })
    .some((finding) => finding.checkId === "code-purity/object-bag-unused-property" && finding.message.includes("other")));
});
