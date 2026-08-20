import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const manifestPath = resolve(repoRoot, "scripts/audit/domains/local-browser-session/manifest.json");
const inspectorPath = resolve(repoRoot, "scripts/audit/domains/local-browser-session/inspector.ts");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { coverage: { bindings: readonly { checkIds: readonly string[] }[] } };
const checkIds = manifest.coverage.bindings.flatMap((binding) => binding.checkIds);
const coreCheckIds = checkIds.filter((checkId) => checkId !== "browser-privacy/no-owner-boundary-leak");
assert.equal(coreCheckIds.length, 26, "The Browser core check set must contain exactly 26 independent checkIds.");
assert.equal(checkIds.length, 27, "The core set plus mandatory P0 privacy check must have 27 physical receipts.");
assert.equal(new Set(checkIds).size, checkIds.length, "Every physical Browser audit checkId must be unique.");
const project = new Project({ tsConfigFilePath: resolve(repoRoot, "tsconfig.json") });
const inspector = project.getSourceFile(inspectorPath);
assert.ok(inspector, "Local Browser inspector must be loadable through ts-morph.");
const executed = inspector.getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "run") return false;
    const receiver = expression.getExpression();
    return Node.isPropertyAccessExpression(receiver) && receiver.getName() === "checks";
  })
  .map((call) => call.getArguments()[0])
  .filter(Node.isStringLiteral)
  .map((argument) => argument.getLiteralValue());
assert.deepEqual(new Set(executed), new Set(checkIds), "Manifest checks and runner-signed physical check callbacks must be identical.");
console.log("LOCAL_BROWSER_CHECK_COVERAGE_AUDIT_ACCEPTANCE_PASS");
