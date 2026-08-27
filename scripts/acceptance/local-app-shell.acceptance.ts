import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Project, SyntaxKind, Node } from "ts-morph";

import { inspectLocalAppShellProject } from "../audit/domains/local-app-shell/inspector.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const paths = [
  "src/app/server.ts",
  "src/app/create-workbench-server.ts",
  "src/app/workbench-browser-websocket-upgrade.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/lib/local-runtime/production/runtime.ts",
] as const;

const fixture = (): Project => {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const path of paths) project.createSourceFile(path, readFileSync(path, "utf8"));
  return project;
};
const checkIds = (project: Project): string[] => inspectLocalAppShellProject(project).map((finding) => finding.message);
const isPropertyCall = (node: Node, name: string): boolean => {
  if (!Node.isCallExpression(node)) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
};

assert.deepEqual(inspectLocalAppShellProject(fixture()), [], "the current owner contract must be the golden fixture");

{
  const project = fixture();
  project.getSourceFileOrThrow("src/app/server.ts").addStatements("server.listen(4174, '127.0.0.1');");
  assert.ok(checkIds(project).some((message) => message.includes("HTTP listener count must be exactly one")));
}
{
  const project = fixture();
  const start = project.getSourceFileOrThrow("src/app/server.ts").getFunctionOrThrow("startLocalRuntime");
  const init = start.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => isPropertyCall(call, "init"));
  const guarded = init?.getAncestors().find((ancestor) => isPropertyCall(ancestor, "catch"));
  guarded?.replaceWithText("workbench.init()");
  assert.ok(checkIds(project).some((message) => message.includes("initialization failure must be caught")));
}
{
  const project = fixture();
  project.getSourceFileOrThrow("src/lib/local-runtime/workbench-handle.ts").addTypeAlias({
    name: "ForbiddenBrowserControl",
    type: "{ selector: string }",
  });
  const findings = inspectLocalAppShellProject(project);
  assert.ok(findings.some((finding) => finding.lawId === "LAW-LOCAL-APP-SHELL-002-V3"
    && finding.message.includes("browser control field selector")));
}
{
  const project = fixture();
  const source = project.getSourceFileOrThrow("src/lib/local-runtime/workbench-status.ts");
  const property = source.getDescendantsOfKind(SyntaxKind.PropertySignature).find((item) => item.getName() === "executionState");
  property?.remove();
  const findings = inspectLocalAppShellProject(project);
  assert.ok(findings.some((finding) => finding.lawId === "LAW-LOCAL-APP-SHELL-003-V3"
    && finding.message.includes("executionState must remain an independently typed status dimension")));
}
{
  const project = fixture();
  const owner = project.getSourceFileOrThrow("src/lib/local-runtime/production/runtime.ts");
  owner.replaceWithText(owner.getFullText().replaceAll('shellState: "ready"', 'shellState: "stopped"'));
  assert.ok(checkIds(project).some((message) => message.includes("must keep Shell ready")));
}

console.log("local-app-shell-acceptance-ok");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-APP-SHELL-001-V6", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:5","forbidden:6","summary"], locator: "acceptance:local-shell:single-owned-shell", observedValue: "single repository-owned Shell health boundary verified" });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-APP-SHELL-002-V3", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:local-shell:boundary-mutants", observedValue: "foreign and duplicate Shell boundary mutants rejected" });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-APP-SHELL-003-V3", evidenceMode: "exam.golden", clauses: ["forbidden:2","summary"], locator: "acceptance:local-shell:degraded-readiness", observedValue: "execution dependency failure keeps diagnostic Shell ready" });
