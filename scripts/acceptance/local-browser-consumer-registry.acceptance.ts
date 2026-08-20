import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  CONSUMERS,
  parseArguments,
  readJson,
  resolveDeliverable,
  writeJson,
} from "./local-browser-plan-harness.self-test.js";

type ConsumerRegistry = Readonly<{
  readonly candidate: string;
  readonly consumers: readonly Readonly<{
    readonly consumerId: string;
    readonly sourcePath: string;
    readonly constructionStatus: string;
  }> [];
}>;

const legacyAcceptances = [
  "scripts/acceptance/local-browser-artifact-contract.acceptance.ts",
  "scripts/acceptance/local-browser-atomic-cutover.acceptance.ts",
  "scripts/acceptance/local-browser-business-workday.acceptance.ts",
  "scripts/acceptance/local-browser-exact-target-contract.acceptance.ts",
  "scripts/acceptance/local-browser-native-transport.acceptance.ts",
  "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts",
  "scripts/acceptance/local-browser-real-chrome.acceptance.ts",
  "scripts/acceptance/local-browser-target-actions.acceptance.ts",
] as const;

const args = parseArguments(process.argv.slice(2));
const requiredArgument = (name: string): string => {
  const value = args.get(name);
  if (typeof value !== "string") throw new Error(`${name} deliverable URI is required.`);
  return value;
};
const registryUri = requiredArgument("--registry");
const registry = readJson<ConsumerRegistry>(registryUri);
assert.deepEqual(registry.consumers.map((consumer) => consumer.consumerId), CONSUMERS.map((consumer) => consumer.consumerId));
assert.ok(registry.consumers.every((consumer) => consumer.constructionStatus === "BLOCKED"));

const cutoverUri = args.get("--cutover");
const demolitionUri = args.get("--demolition");
if (typeof cutoverUri === "string" && typeof demolitionUri === "string" && !args.has("--verify-targets-absent")) {
  const consumers = registry.consumers.map((consumer) => ({
    ...consumer,
    migration: CONSUMERS.find((expected) => expected.consumerId === consumer.consumerId),
  }));
  writeJson(cutoverUri, {
    schemaVersion: "browser-retirement-cutover-ledger.v1",
    candidate: registry.candidate,
    consumers,
    status: "CONSTRUCTION_BLOCKED",
    rule: "Every consumer remains BLOCKED until its named migration acceptance passes; no legacy wrapper is lawful.",
  });
  writeJson(demolitionUri, {
    schemaVersion: "browser-demolition-admission.v1",
    candidate: registry.candidate,
    authority: "ABSENT",
    consumers: registry.consumers.map((consumer) => consumer.consumerId),
    status: "ADMITTED_FOR_PHYSICAL_DEMOLITION",
  });
}

const targetList = String(args.get("--verify-targets-absent") ?? "")
  .split(",")
  .filter(Boolean);
for (const target of targetList) {
  assert.equal(existsSync(path.resolve(target)), false, `Retired Local Runtime path remains: ${target}`);
}
if (args.has("--verify-listed-legacy-acceptance-absent")) {
  for (const legacyPath of legacyAcceptances) {
    assert.equal(existsSync(path.resolve(legacyPath)), false, `Legacy Browser acceptance remains: ${legacyPath}`);
  }
}
if (args.has("--verify-no-alias")) {
  assert.ok(targetList.length > 0, "--verify-no-alias must be paired with explicit retired targets.");
}

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  candidate: registry.candidate,
  registryPath: resolveDeliverable(registryUri),
  cutoverPath: typeof cutoverUri === "string" ? resolveDeliverable(cutoverUri) : undefined,
  demolitionPath: typeof demolitionUri === "string" ? resolveDeliverable(demolitionUri) : undefined,
})}\n`);
