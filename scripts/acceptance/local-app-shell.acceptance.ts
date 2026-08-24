import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Project, SyntaxKind, Node } from "ts-morph";

import { inspectLocalAppShellProject } from "../audit/domains/local-app-shell/inspector.js";

const paths = [
  "src/app/server.ts",
  "src/app/create-workbench-server.ts",
  "src/app/workbench-browser-websocket-upgrade.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.workbench-owner.ts",
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
  assert.ok(checkIds(project).some((message) => message.includes("browser control field selector")));
}
{
  const project = fixture();
  const source = project.getSourceFileOrThrow("src/lib/local-runtime/workbench-status.ts");
  const property = source.getDescendantsOfKind(SyntaxKind.PropertySignature).find((item) => item.getName() === "executionState");
  property?.remove();
  assert.ok(checkIds(project).some((message) => message.includes("executionState must remain an independently typed status dimension")));
}
{
  const project = fixture();
  const owner = project.getSourceFileOrThrow("src/plugins/xuanxue-ai-production/xuanxue-ai-production.workbench-owner.ts");
  const failure = owner.getVariableDeclarationOrThrow("startupFailureHealth");
  const shell = failure.getDescendantsOfKind(SyntaxKind.PropertyAssignment).find((item) => item.getName() === "shellState");
  shell?.setInitializer('"stopped"');
  assert.ok(checkIds(project).some((message) => message.includes("must keep Shell ready")));
}

console.log("local-app-shell-acceptance-ok");
