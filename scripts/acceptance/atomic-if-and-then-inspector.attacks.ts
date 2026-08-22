import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { Project, type SourceFile } from "ts-morph";

import { exactChoiceTransactionIsAtomic } from
  "../audit/domains/ai-input-gateway/atomic-if-and-then-inspector.js";
import { domAtomicIfAndThenContractIsExact } from
  "../audit/domains/dom-automation/inspector.js";
import {
  browserMutationLedgerIsAtomic,
  exactTextMatcherIsStrict,
} from "../audit/domains/local-browser-session/inspector.js";

const sourceText = (path: string): string => readFileSync(path, "utf8");

const mutatedSource = (
  project: Project,
  path: string,
  from: string,
  to: string,
): SourceFile => {
  const original = sourceText(path);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `attack precondition did not match ${path}`);
  return project.createSourceFile(path, mutated, { overwrite: true });
};

export const runAiInputGatewayAtomicInspectorAttacks = (): void => {
  const path = "src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts";
  const baseline = new Project({ useInMemoryFileSystem: true })
    .createSourceFile(path, sourceText(path));
  assert.equal(exactChoiceTransactionIsAtomic(baseline), true);

  const prefixProject = new Project({ useInMemoryFileSystem: true });
  const prefix = mutatedSource(
    prefixProject,
    path,
    "expectedTextEquals: input.expectedValue,",
    "expectedTextEquals: input.expectedValue.slice(0, 1),",
  );
  assert.equal(exactChoiceTransactionIsAtomic(prefix), false,
    "a prefix matcher must fail the AI atomic-action inspector");

  const missingPostconditionProject = new Project({ useInMemoryFileSystem: true });
  const missingPostcondition = mutatedSource(
    missingPostconditionProject,
    path,
    "postClickAttribute: { name: \"aria-checked\", equals: \"true\" },",
    "postClickAttribute: undefined,",
  );
  assert.equal(exactChoiceTransactionIsAtomic(missingPostcondition), false,
    "a missing same-command postcondition must fail the AI atomic-action inspector");
};

export const runLocalBrowserAtomicInspectorAttacks = (): void => {
  const managerPath = "src/lib/browser/exact-target/browser-target-lease-manager.ts";
  const runtimePath = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
  const baseline = new Project({ useInMemoryFileSystem: true });
  assert.equal(browserMutationLedgerIsAtomic(
    baseline.createSourceFile(managerPath, sourceText(managerPath)),
  ), true);
  assert.equal(exactTextMatcherIsStrict(
    baseline.createSourceFile(runtimePath, sourceText(runtimePath)),
  ), true);

  const decoyProject = new Project({ useInMemoryFileSystem: true });
  const decoy = mutatedSource(
    decoyProject,
    managerPath,
    "if (commandIds.length !== 1 || commandId === undefined) throw new Error(\"BROWSER_OUTCOME_UNKNOWN\");",
    "if (false && commandIds.length !== 1) throw new Error(\"BROWSER_OUTCOME_UNKNOWN\");\n    if (commandIds.length !== 0 || commandId === undefined) throw new Error(\"BROWSER_OUTCOME_UNKNOWN\");",
  );
  assert.equal(browserMutationLedgerIsAtomic(decoy), false,
    "an unreachable compliant decoy must not hide the broken effective guard");

  const substringProject = new Project({ useInMemoryFileSystem: true });
  const substring = mutatedSource(
    substringProject,
    runtimePath,
    "(await nodeText(runtime, tabId, nodeId)).trim() === expected",
    "(await nodeText(runtime, tabId, nodeId)).trim().includes(expected)",
  );
  assert.equal(exactTextMatcherIsStrict(substring), false,
    "substring containment must fail the Browser exact-identity inspector");
};

export const runDomAtomicInspectorAttacks = (): void => {
  const intentPath = "src/lib/browser/exact-target/browser-dom-intent.ts";
  const runtimePath = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
  const actorPath = "src/lib/browser/exact-target/browser-command-actor.ts";
  const baseline = new Project({ useInMemoryFileSystem: true });
  const intent = baseline.createSourceFile(intentPath, sourceText(intentPath));
  const runtime = baseline.createSourceFile(runtimePath, sourceText(runtimePath));
  const actor = baseline.createSourceFile(actorPath, sourceText(actorPath));
  assert.equal(domAtomicIfAndThenContractIsExact(intent, runtime, actor), true);

  const substringProject = new Project({ useInMemoryFileSystem: true });
  const substringRuntime = mutatedSource(
    substringProject,
    runtimePath,
    "(await nodeText(runtime, tabId, nodeId)).trim() === expected",
    "(await nodeText(runtime, tabId, nodeId)).trim().includes(expected)",
  );
  assert.equal(domAtomicIfAndThenContractIsExact(
    substringProject.createSourceFile(intentPath, sourceText(intentPath)),
    substringRuntime,
    substringProject.createSourceFile(actorPath, sourceText(actorPath)),
  ), false, "substring containment must fail the DOM atomic-action inspector");

  const actorProject = new Project({ useInMemoryFileSystem: true });
  const brokenActor = mutatedSource(
    actorProject,
    actorPath,
    "value.postconditionVerified === true",
    "value.postconditionVerified !== true",
  );
  assert.equal(domAtomicIfAndThenContractIsExact(
    actorProject.createSourceFile(intentPath, sourceText(intentPath)),
    actorProject.createSourceFile(runtimePath, sourceText(runtimePath)),
    brokenActor,
  ), false, "a broken postcondition receipt must fail the DOM atomic-action inspector");
};
