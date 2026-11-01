import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";

import type { Law, Registry } from "../../scripts/audit/governance-contract.js";
import { GovernanceError } from "../../scripts/audit/governance-runtime.js";
import { buildQualityReport, type LawExecutionResult, type QualityReport } from "../../scripts/audit/shared/quality-contract.js";
import { assertQualityCommandPassed, collectQualityCheck, executeCaptured, mapWithConcurrency, type QualityCheckIssue } from "../../scripts/audit/shared/quality-process-execution.js";

const root = process.cwd();
const loader = resolve(root, "node_modules/tsx/dist/loader.mjs");
const lawFor = (domain: string, id: string): Law => ({
  schemaVersion: 2, lawId: id, supersedesLawId: null, status: "active", tier: "P0",
  capabilityDomain: domain, enforcementMode: "composite", evidenceModes: ["static.ast", "exam.golden", "dynamic.service"],
  summary: "必须验证执行结果。", forbidden: ["不得隐藏失败。"], appliesTo: ["src/**"], excludes: [],
  dependsOnLawIds: [], contractRefs: [], source: { path: "AGENTS.md", lineStart: 1, lineEnd: 1 },
});
const fixtureLaws = [lawFor("local-app-shell", "LAW-APP-FIXTURE-001-V1"), lawFor("gpt", "LAW-GPT-FIXTURE-001-V1")];
const fixtureRegistry: Registry = {
  schemaVersion: 5, sourceSpec: { path: "docs/governance/法案系统建设说明书-冻结定稿版.md" },
  lawCorpus: { baseLawPath: ".github/instructions/agent-rules/基础法案.md", functionalLawPath: ".github/instructions/agent-rules/功能法案.md" },
  laws: fixtureLaws,
  domains: fixtureLaws.map((law) => ({ capabilityDomain: law.capabilityDomain, manifestPath: `scripts/audit/domains/${law.capabilityDomain}/manifest.json`,
    lawIds: [law.lawId], ownedPaths: ["src/**"], observedPaths: [] })),
};
const temporaryRepository = (): { directory: string; repo: string; save: (path: string, source: string) => void; commit: () => void } => {
  const directory = mkdtempSync(resolve(tmpdir(), "quality-execution-test-"));
  const repo = resolve(directory, "repo");
  mkdirSync(repo);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  const save = (path: string, source: string): void => {
    const target = resolve(repo, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  };
  save(".gitignore", "node_modules\nscripts/audit/reports/\n");
  save("AGENTS.md", readFileSync(resolve(root, "AGENTS.md"), "utf8"));
  save("package.json", readFileSync(resolve(root, "package.json"), "utf8"));
  symlinkSync(resolve(root, "node_modules"), resolve(repo, "node_modules"), "dir");
  const commit = (): void => {
    execFileSync("git", ["add", "."], { cwd: repo });
    execFileSync("git", ["-c", "user.name=Quality fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"], { cwd: repo });
  };
  return { directory, repo, save, commit };
};

const runCoreFixture = (scenario: "ordinary" | "drift" | "authority" | "duplicate" | "wrong-id" | "index") => {
  const fixture = temporaryRepository();
  const commands = resolve(fixture.directory, "commands.log");
  const registry = structuredClone(fixtureRegistry);
  if (scenario === "duplicate") {
    const additionalLaw = lawFor("local-app-shell", "LAW-APP-FIXTURE-002-V1");
    registry.laws.push(additionalLaw);
    registry.domains[0]!.lawIds.push(additionalLaw.lawId);
    registry.laws.sort((left, right) => left.lawId.localeCompare(right.lawId));
  }
  fixture.save("src/fixture.ts", "export const fixture = 1;\n");
  fixture.save("scripts/audit/reports/law-quality.report.json", "prior report must remain on integrity failure\n");
  fixture.save("scripts/audit/shared/quality-inspector-worker.ts", `
import {readFileSync,writeFileSync} from 'node:fs';
const request=JSON.parse(readFileSync(process.env.GOVERNANCE_INSPECTION_REQUEST,'utf8'));
if (${JSON.stringify(scenario)}==='drift') writeFileSync(${JSON.stringify(resolve(fixture.repo, "src/fixture.ts"))}, 'export const fixture=2;');
if (request.capabilityDomain==='gpt') { process.stderr.write('fixture inspector crash'); process.exitCode=1; }
else process.stdout.write('GOVERNANCE_INSPECTOR_RESULT '+JSON.stringify({
 capabilityDomain:request.capabilityDomain, reportedLawIds:request.laws.map(l=>l.lawId), inspectedFiles:request.targetPaths,
 lawResults:request.laws.map(l=>({lawId:${JSON.stringify(scenario)}==='duplicate'?request.laws[0].lawId:${JSON.stringify(scenario)}==='wrong-id'?'LAW-WRONG-FIXTURE-001-V1':l.lawId, assertions:[{clauses:['forbidden:0','summary'], evidenceMode:'static.ast',passed:true,refs:['ast:src/fixture.ts#fixture']}],findings:[]}))
})+'\\n');
`);
  const npmPath = resolve(fixture.repo, "bin/npm");
  fixture.save("bin/npm", `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';\nappendFileSync(${JSON.stringify(commands)},process.argv.slice(2).join(' ')+'\\n');\nprocess.stderr.write('fixture Exam failure');\nprocess.exitCode=1;\n`);
  chmodSync(npmPath, 0o700);
  if (scenario === "authority") registry.domains[0]!.ownedPaths = ["other/**"];
  const script = resolve(fixture.directory, "run.mts");
  writeFileSync(script, `import {runFullQuality} from ${JSON.stringify(resolve(root, "scripts/audit/shared/quality-runner.ts"))};\ntry {const r=await runFullQuality('READY',${JSON.stringify(registry)},[{label:'typecheck',status:'FAILED',message:'fixture type error'}]);process.exitCode=r.outcome==='PASS'?0:1;} catch(e){console.error(e.code,e.message);process.exitCode=1;}\n`);
  fixture.commit();
  if (scenario === "index") {
    fixture.save("src/fixture.ts", "export const fixture = 2;\n");
    execFileSync("git", ["add", "src/fixture.ts"], { cwd: fixture.repo });
    fixture.save("src/fixture.ts", "export const fixture = 1;\n");
    assert.equal(execFileSync("git", ["diff", "HEAD"], { cwd: fixture.repo, encoding: "utf8" }), "");
    assert.match(execFileSync("git", ["status", "--porcelain"], { cwd: fixture.repo, encoding: "utf8" }), /^MM src\/fixture.ts/mu);
  }
  const output = spawnSync(process.execPath, ["--import", loader, script], { cwd: fixture.repo, encoding: "utf8",
    env: { ...process.env, CI: "", GRASSEYE_QUALITY_OUTPUT_DIR: "", PATH: `${resolve(fixture.repo, "bin")}:${process.env.PATH}` } });
  return { ...fixture, commands, output, laws: registry.laws };
};

test("native READY refuses a staged change even when the worktree equals HEAD", () => {
  const fixture = runCoreFixture("index");
  try {
    assert.notEqual(fixture.output.status, 0);
    assert.match(fixture.output.stderr, /READY_GIT_COMMIT_REQUIRED/u);
    assert.equal(readFileSync(resolve(fixture.repo, "scripts/audit/reports/law-quality.report.json"), "utf8"),
      "prior report must remain on integrity failure\n");
    assert.equal(fixture.output.stdout, "");
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("the existing candidate fingerprint sees index-only byte changes in an MM worktree", () => {
  const fixture = temporaryRepository();
  try {
    fixture.save("src/fixture.ts", "export const fixture = 1;\n"); fixture.commit();
    const script = resolve(fixture.directory, "fingerprint.mts");
    writeFileSync(script, `import {worktreeCandidateFingerprint} from ${JSON.stringify(resolve(root, "scripts/audit/governance-git-state.ts"))}; console.log(worktreeCandidateFingerprint());`);
    const fingerprint = () => execFileSync(process.execPath, ["--import", loader, script], { cwd: fixture.repo, encoding: "utf8" });
    fixture.save("src/fixture.ts", "export const fixture = 2;\n");
    execFileSync("git", ["add", "src/fixture.ts"], { cwd: fixture.repo });
    fixture.save("src/fixture.ts", "export const fixture = 1;\n"); const before = fingerprint();
    fixture.save("src/fixture.ts", "export const fixture = 3;\n");
    execFileSync("git", ["add", "src/fixture.ts"], { cwd: fixture.repo });
    fixture.save("src/fixture.ts", "export const fixture = 1;\n");
    assert.notEqual(fingerprint(), before);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("ordinary stderr mentioning an integrity code does not acquire authority", () => {
  assert.throws(() => assertQualityCommandPassed({ status: 1, signal: null, stdout: "",
    stderr: "ordinary explanation about SOURCE_PARSE_FAILED\n" }, "ordinary"),
    (error: unknown) => error instanceof GovernanceError && error.code === "CHECK_EXECUTION_FAILED");
});

test("ordinary concurrent failures retain every issue and successful independent result", async () => {
  const issues: QualityCheckIssue[] = [];
  const visited: number[] = [];
  const results = await mapWithConcurrency([0, 1, 2, 3], 2, (value) => collectQualityCheck(String(value), () => {
    visited.push(value);
    if (value < 2) throw new Error(`failure ${value}`);
    return value;
  }, () => {}, issues));
  assert.deepEqual([...visited].sort(), [0, 1, 2, 3]);
  assert.deepEqual(results, [undefined, undefined, 2, 3]);
  assert.equal(issues.length, 2);
  assert.ok(issues.some((issue) => issue.message.includes("failure 0")));
  assert.ok(issues.some((issue) => issue.message.includes("failure 1")));
});

test("candidate drift wins over a lower-index ordinary error and stops dispatch", async () => {
  const visited: number[] = [];
  await assert.rejects(mapWithConcurrency([0, 1, 2, 3, 4], 2, async (value) => {
    visited.push(value);
    if (value === 0) { await new Promise((done) => setTimeout(done, 20)); throw new Error("ordinary failure"); }
    throw new GovernanceError("CANDIDATE_DRIFT", "changed");
  }), (error: unknown) => error instanceof GovernanceError && error.code === "CANDIDATE_DRIFT");
  assert.deepEqual(visited, [0, 1]);
});

test("failed commands are rechecked for drift before an ordinary issue can be recorded", async () => {
  const issues: QualityCheckIssue[] = [];
  let changed = false;
  await assert.rejects(collectQualityCheck("failed command", () => {
    changed = true;
    throw new Error("ordinary failure");
  }, () => { if (changed) throw new GovernanceError("CANDIDATE_DRIFT", "changed during command"); }, issues),
  (error: unknown) => error instanceof GovernanceError && error.code === "CANDIDATE_DRIFT");
  assert.deepEqual(issues, []);
});

test("an authority failure aborts collection without disguising it as an ordinary check", async () => {
  const issues: QualityCheckIssue[] = [];
  await assert.rejects(collectQualityCheck("source", () => { throw new GovernanceError("SOURCE_PARSE_FAILED", "authority unreadable"); },
    () => {}, issues), (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED");
  assert.deepEqual(issues, []);
});

test("a real acceptance group executes later files and preserves stdout after the first file fails", () => {
  const fixture = temporaryRepository();
  try {
    fixture.save("fail.mjs", "console.error('first failure');process.exitCode=1;\n");
    fixture.save("pass.mjs", "console.log('GOVERNANCE_PROOF_OBSERVATION fixture-output-preserved');\n");
    fixture.commit();
    const output = spawnSync(process.execPath, ["--import", loader, resolve(root, "scripts/audit/shared/quality-process-execution.ts"), "fail.mjs", "pass.mjs"],
      { cwd: fixture.repo, encoding: "utf8" });
    assert.notEqual(output.status, 0);
    assert.match(output.stdout, /fixture-output-preserved/u);
    assert.match(output.stderr, /\[FAILED\] fail.mjs/u);
    assert.doesNotMatch(output.stdout, /CHANGE_PASS|READY_PASS|RELEASE_PASS/u);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("streamed output releases a real child before exit and is captured exactly once", async () => {
  const fixture = temporaryRepository();
  try {
    const release = resolve(fixture.directory, "release");
    fixture.save("child.mjs", `import {existsSync} from 'node:fs';
process.stdout.write('GOVERNANCE_PROOF_OBSERVATION fixture-streamed\\n');
process.stderr.write('child-diagnostic\\n');
const deadline=Date.now()+2000;
while(!existsSync(${JSON.stringify(release)})) {
  if(Date.now()>=deadline) throw new Error('output was not streamed before exit');
  await new Promise(done=>setTimeout(done,5));
}
process.stdout.write('after-release\\n');process.exitCode=7;
`);
    fixture.save("stream.mts", `import {executeCaptured} from ${JSON.stringify(resolve(root, "scripts/audit/shared/quality-process-execution.ts"))};
const result=await executeCaptured(process.execPath,['child.mjs'],{cwd:process.cwd(),env:process.env,streamOutput:true});
console.log('CAPTURED '+JSON.stringify(result));
`);
    const child = spawn(process.execPath, ["--import", loader, "stream.mts"], { cwd: fixture.repo });
    let stdout = "", stderr = "", released = false;
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (!released && stdout.includes("GOVERNANCE_PROOF_OBSERVATION fixture-streamed\n")) {
        writeFileSync(release, "release"); released = true;
      }
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    const code = await new Promise<number | null>((done, reject) => {
      child.once("error", reject); child.once("close", done);
    });
    assert.equal(code, 0); assert.equal(released, true);
    const captured = JSON.parse(stdout.split("\n").find(line => line.startsWith("CAPTURED "))!.slice(9));
    assert.deepEqual(captured, { status: 7, signal: null,
      stdout: "GOVERNANCE_PROOF_OBSERVATION fixture-streamed\nafter-release\n", stderr: "child-diagnostic\n" });
    assert.equal(stdout.split("\n").filter(line => line === "GOVERNANCE_PROOF_OBSERVATION fixture-streamed").length, 1);
    assert.equal(stderr.split("\n").filter(line => line === "child-diagnostic").length, 1);
    assert.match(stderr, /command:end.*status=7 signal=null/u);
    for (const execution of [
      await executeCaptured(resolve(fixture.directory, "missing-command"), [], { cwd: fixture.repo, env: process.env }),
      await executeCaptured(process.execPath, ["-e", "process.kill(process.pid,'SIGTERM')"], { cwd: fixture.repo, env: process.env }),
    ]) {
      assert.equal(execution.status, null);
      assert.throws(() => assertQualityCommandPassed(execution, "not-success"));
    }
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("the actual Product acceptance entry preserves child authority failures for its parent and stops later Products", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "quality-product-integrity-"));
  const repo = resolve(directory, "repo");
  try {
    execFileSync("git", ["clone", "-q", "--local", "--no-hardlinks", "--single-branch", "--branch", "main", root, repo]);
    writeFileSync(resolve(repo, ".git/info/exclude"), "node_modules\n");
    symlinkSync(resolve(root, "node_modules"), resolve(repo, "node_modules"), "dir");
    for (const path of ["scripts/acceptance/architecture-boundary.acceptance.ts", "scripts/audit/governance-git-state.ts", "scripts/audit/shared/quality-process-execution.ts", ".github/instructions/agent-rules/功能法案.md"]) {
      writeFileSync(resolve(repo, path), readFileSync(resolve(root, path)));
    }
    const products = readdirSync(resolve(repo, "scripts/acceptance/product-plugins")).filter((path) => path.endsWith(".acceptance.ts")).sort();
    assert.ok(products.length > 1);
    writeFileSync(resolve(repo, "scripts/acceptance/product-plugins", products[0]!), "import { fail } from '../../audit/governance-runtime.js'; fail('SOURCE_PARSE_FAILED', 'Product authority unreadable');\n");
    writeFileSync(resolve(repo, "scripts/acceptance/product-plugins", products[1]!), "console.log('LATER_PRODUCT_MUST_NOT_RUN');\n");
    const receipts = resolve(directory, "native-receipts");
    mkdirSync(receipts, { mode: 0o700 });
    const candidate = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    const output = spawnSync(process.execPath, ["--import", loader, resolve(repo, "scripts/acceptance/architecture-boundary.acceptance.ts")], {
      cwd: repo, encoding: "utf8", env: { ...process.env, GOVERNANCE_PROOF_KIND: "exam", GOVERNANCE_PROOF_RUN_ID: "a".repeat(64),
        GOVERNANCE_PROOF_CANDIDATE: candidate, GOVERNANCE_PROOF_SCRIPT: "acceptance:architecture-boundary", GOVERNANCE_PROOF_TIMEOUT_MS: "300000", GOVERNANCE_PROOF_RECEIPT_DIR: receipts },
    });
    assert.notEqual(output.status, 0);
    assert.match(output.stderr, /code: 'SOURCE_PARSE_FAILED'/u);
    assert.doesNotMatch(output.stdout, /LATER_PRODUCT_MUST_NOT_RUN|QUALITY_PROOF_OBSERVATION/u);
    const issues: QualityCheckIssue[] = [];
    await assert.rejects(collectQualityCheck("Product Exam", () => assertQualityCommandPassed(output, "acceptance:architecture-boundary"),
      () => {}, issues), (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED");
    assert.deepEqual(issues, []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("native READY core continues Static and every Exam after project and domain failure", () => {
  const fixture = runCoreFixture("ordinary");
  try {
    assert.notEqual(fixture.output.status, 0, fixture.output.stderr);
    assert.match(fixture.output.stdout, /READY_FAIL/u);
    const report = JSON.parse(readFileSync(resolve(fixture.repo, "scripts/audit/reports/law-quality.report.json"), "utf8")) as QualityReport;
    assert.deepEqual(report.laws.map((law) => law.lawId), fixtureLaws.map((law) => law.lawId));
    assert.equal(report.outcome, "FAIL");
    assert.equal(report.laws[0]!.evidence[0]?.evidenceMode, "static.ast");
    assert.ok(report.laws[1]!.findings.some((finding) => finding.code === "CHECK_EXECUTION_FAILED"));
    assert.deepEqual(readFileSync(fixture.commands, "utf8").trim().split("\n").sort(), ["run acceptance:gpt", "run acceptance:local-app-shell"]);
    assert.equal(report.laws.every((law) => law.requiredEvidenceModes.includes("exam.golden") && law.deferredEvidenceModes.includes("dynamic.service")), true);
    assert.match(fixture.output.stderr, /\[FAILED\] typecheck/u);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

for (const scenario of ["duplicate", "wrong-id"] as const) test(`native READY core collects ${scenario} Static law results and continues every Exam`, () => {
  const fixture = runCoreFixture(scenario);
  try {
    assert.notEqual(fixture.output.status, 0);
    assert.match(fixture.output.stdout, /READY_FAIL/u, fixture.output.stderr);
    const report = JSON.parse(readFileSync(resolve(fixture.repo, "scripts/audit/reports/law-quality.report.json"), "utf8")) as QualityReport;
    assert.deepEqual(report.laws.map((law) => law.lawId), fixture.laws.map((law) => law.lawId));
    assert.equal(report.outcome, "FAIL");
    const localLawIds = fixture.laws.filter((law) => law.capabilityDomain === "local-app-shell").map((law) => law.lawId);
    assert.ok(report.laws.filter((law) => localLawIds.includes(law.lawId))
      .every((law) => law.findings.some((finding) => finding.code === "CHECK_EXECUTION_FAILED")));
    assert.match(fixture.output.stderr, scenario === "duplicate" ? /LAW_EVIDENCE_DUPLICATE/u : /LAW_DENOMINATOR_MISSING/u);
    assert.deepEqual(readFileSync(fixture.commands, "utf8").trim().split("\n").sort(), ["run acceptance:gpt", "run acceptance:local-app-shell"]);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("native READY entry records missing governance tests as BLOCKED and still reaches Static and Exam", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "quality-missing-tests-"));
  const repo = resolve(directory, "repo");
  try {
    execFileSync("git", ["clone", "-q", "--local", "--no-hardlinks", "--single-branch", "--branch", "main", root, repo]);
    writeFileSync(resolve(repo, ".git/info/exclude"), "node_modules\n");
    symlinkSync(resolve(root, "node_modules"), resolve(repo, "node_modules"), "dir");
    cpSync(resolve(root, "scripts/audit"), resolve(repo, "scripts/audit"), { recursive: true });
    cpSync(resolve(root, ".github/instructions/agent-rules"), resolve(repo, ".github/instructions/agent-rules"), { recursive: true });
    cpSync(resolve(root, "docs/blueprints"), resolve(repo, "docs/blueprints"), { recursive: true });
    cpSync(resolve(root, "docs/specs"), resolve(repo, "docs/specs"), { recursive: true });
    writeFileSync(resolve(repo, "package.json"), readFileSync(resolve(root, "package.json")));
    rmSync(resolve(repo, "tests/governance"), { recursive: true });
    mkdirSync(resolve(directory, "bin"));
    writeFileSync(resolve(directory, "bin/npm"), `#!${process.execPath}\nconsole.log('fixture command '+process.argv.slice(2).join(' '));\n`);
    chmodSync(resolve(directory, "bin/npm"), 0o700);
    writeFileSync(resolve(repo, "scripts/audit/shared/quality-inspector-worker.ts"), "export function runInspectionWorker(){process.stderr.write('fixture Static failure');process.exitCode=1;}if(process.env.GOVERNANCE_INSPECTION_REQUEST)runInspectionWorker();\n");
    execFileSync("git", ["add", "."], { cwd: repo });
    execFileSync("git", ["-c", "user.name=Quality fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "missing tests fixture"], { cwd: repo });
    const output = spawnSync(process.execPath, ["--import", loader, realpathSync(resolve(repo, "scripts/audit/governance.ts")), "quality", "READY"],
      { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, CI: "", GRASSEYE_QUALITY_OUTPUT_DIR: "", PATH: `${resolve(directory, "bin")}:${process.env.PATH}` } });
    assert.notEqual(output.status, 0);
    assert.match(output.stderr, /\[BLOCKED\] governance tests: LAW_EVIDENCE_MISSING/u, output.stderr);
    assert.match(output.stdout, /READY_FAIL/u, output.stderr);
    assert.match(output.stdout + output.stderr, /fixture Static failure/u);
    assert.match(output.stdout + output.stderr, /fixture command run acceptance:gpt/u);
    const report = JSON.parse(readFileSync(resolve(repo, "scripts/audit/reports/law-quality.report.json"), "utf8")) as QualityReport;
    assert.equal(report.outcome, "FAIL");
    assert.equal(report.laws.length, 39);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const scenario of ["drift", "authority"] as const) test(`native core ${scenario} failure leaves the previous report intact`, () => {
  const fixture = runCoreFixture(scenario);
  try {
    assert.notEqual(fixture.output.status, 0);
    assert.match(fixture.output.stderr, scenario === "drift" ? /CANDIDATE_DRIFT/u : /TARGET_OUTSIDE_DOMAIN_AUTHORITY/u);
    assert.doesNotMatch(fixture.output.stdout, /QUALITY_REPORT|READY_PASS|READY_FAIL/u);
    assert.equal(readFileSync(resolve(fixture.repo, "scripts/audit/reports/law-quality.report.json"), "utf8"), "prior report must remain on integrity failure\n");
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("project failure produces the sole top-level FAIL without inventing a law finding or a report field", () => {
  const law = { ...fixtureLaws[0]!, source: { path: "AGENTS.md", lineStart: 1, lineEnd: 1 }, evidenceModes: ["static.ast"] };
  const result: LawExecutionResult = { lawId: law.lawId, findings: [], assertions: [{
    clauses: ["forbidden:0", "summary"], evidenceMode: "static.ast", passed: true, refs: ["ast:scripts/audit/governance.ts#quality"],
  }] };
  const report = buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [result], projectChecksPassed: false });
  assert.equal(report.outcome, "FAIL");
  assert.equal(report.laws[0]!.outcome, "PASS");
  assert.deepEqual(report.laws[0]!.findings, []);
  assert.deepEqual(Object.keys(report).sort(), ["gitCommit", "laws", "level", "outcome", "participants", "schemaVersion"]);
});

test("blocked RELEASE evidence remains required and absent instead of becoming deferred or fabricated", () => {
  const law = { ...fixtureLaws[0]!, source: { path: "AGENTS.md", lineStart: 1, lineEnd: 1 } };
  const report = buildQualityReport({ level: "RELEASE", gitCommit: "a".repeat(40), laws: [law], results: [{ lawId: law.lawId, assertions: [], findings: [] }] });
  assert.equal(report.outcome, "FAIL");
  assert.deepEqual(report.laws[0]!.deferredEvidenceModes, []);
  assert.ok(report.laws[0]!.requiredEvidenceModes.includes("dynamic.service"));
  assert.deepEqual(report.laws[0]!.evidence, []);
  assert.ok(report.laws[0]!.findings.some((finding) => finding.code === "LAW_EVIDENCE_MISSING"));
});

for (const drift of [false, true]) test(`native CHANGE ${drift ? "aborts on drift" : "collects typecheck and focused-test failures"}`, () => {
  const fixture = temporaryRepository();
  try {
    for (const path of ["docs/governance/法案系统建设说明书-冻结定稿版.md", ".github/instructions/agent-rules/基础法案.md", ".github/instructions/agent-rules/功能法案.md", "scripts/audit/generated/law-registry.generated.json"]) {
      fixture.save(path, readFileSync(resolve(root, path), "utf8"));
    }
    fixture.save("tests/governance/focused.test.ts", "console.log('initial test');\n");
    fixture.save("bin/npm", `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';\nif(process.argv[3]==='typecheck'){console.error('fixture typecheck failure');\n${drift ? `writeFileSync('tests/governance/focused.test.ts', 'console.log("drifted test");');` : ""}\nprocess.exitCode=1;}else console.log('related Exam executed');\n`);
    chmodSync(resolve(fixture.repo, "bin/npm"), 0o700);
    fixture.commit();
    fixture.save("tests/governance/focused.test.ts", "console.log('focused test executed after typecheck failure');process.exitCode=1;\n");
    const environment = { ...process.env, PATH: `${resolve(fixture.repo, "bin")}:${process.env.PATH}` };
    delete environment.NODE_TEST_CONTEXT;
    const output = spawnSync(process.execPath, ["--import", loader, resolve(root, "scripts/audit/governance.ts"), "quality", "CHANGE"],
      { cwd: fixture.repo, encoding: "utf8", env: environment });
    assert.notEqual(output.status, 0);
    if (drift) {
      assert.match(output.stderr, /CANDIDATE_DRIFT/u);
      assert.doesNotMatch(output.stdout, /focused test executed|CHANGE_PASS|CHANGE_FAIL/u);
    } else {
      assert.match(output.stdout, /focused test executed after typecheck failure/u, output.stderr);
      assert.match(output.stdout, /CHANGE_FAIL/u);
      assert.match(output.stderr, /2 CHANGE checks failed or blocked/u);
    }
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});
