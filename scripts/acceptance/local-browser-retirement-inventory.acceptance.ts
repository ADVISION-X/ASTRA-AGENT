import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  CONSUMERS,
  buildConsumerRegistry,
  buildFileClassification,
  parseArguments,
  readJson,
  resolveDeliverable,
  writeJson,
} from "./local-browser-plan-harness.self-test.js";

type Classification = Readonly<{
  readonly candidate: string;
  readonly deleteTargets: readonly Readonly<{ readonly filePath: string; readonly classification: string }> [];
  readonly unclassifiedPaths: readonly string[];
}>;

type ConsumerRegistry = Readonly<{
  readonly candidate: string;
  readonly consumers: readonly Readonly<{ readonly consumerId: string }> [];
}>;

const args = parseArguments(process.argv.slice(2));
const requiredArgument = (name: string): string => {
  const value = args.get(name);
  if (typeof value !== "string") throw new Error(`${name} deliverable URI is required.`);
  return value;
};
const classificationUri = requiredArgument("--classification");
const consumersUri = args.get("--consumers");

const requiredIds = String(args.get("--require-consumer-ids") ?? "")
  .split(",")
  .filter(Boolean);
const verifyAllTargetsAbsent = args.has("--verify-all-browser-targets-absent");

let classification: Classification;
let registry: ConsumerRegistry | undefined;
if (verifyAllTargetsAbsent) {
  classification = readJson<Classification>(classificationUri);
  for (const target of classification.deleteTargets) {
    assert.equal(existsSync(path.resolve(target.filePath)), false, `Retired Browser target remains: ${target.filePath}`);
  }
} else {
  classification = buildFileClassification();
  writeJson(classificationUri, classification);
  if (typeof consumersUri !== "string") throw new Error("--consumers deliverable URI is required when creating retirement inventory.");
  registry = buildConsumerRegistry(classification.candidate);
  writeJson(consumersUri, registry);
}

assert.equal(classification.unclassifiedPaths.length, 0, "Every baseline Browser path must be classified.");
assert.ok(classification.deleteTargets.length > 0, "At least one Browser target must be scheduled for physical deletion.");
assert.ok(classification.deleteTargets.every((target) => target.classification === "DELETE"), "Greenfield retirement permits only DELETE classifications.");

if (args.has("--require-zero-unclassified")) {
  assert.equal(classification.unclassifiedPaths.length, 0);
}
if (requiredIds.length > 0) {
  let resolvedRegistry = registry;
  if (!resolvedRegistry) {
    if (typeof consumersUri !== "string") throw new Error("--consumers deliverable URI is required for consumer assertions.");
    resolvedRegistry = readJson<ConsumerRegistry>(consumersUri);
  }
  assert.deepEqual(resolvedRegistry.consumers.map((consumer) => consumer.consumerId), requiredIds);
  assert.equal(resolvedRegistry.consumers.length, CONSUMERS.length);
}
if (args.has("--verify-no-import-reachability")) {
  assert.equal(
    classification.deleteTargets.some((target) => target.filePath.startsWith("src/lib/browser/")),
    true,
    "Deletion receipt must originate from the Browser root.",
  );
}

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  candidate: classification.candidate,
  deleteTargetCount: classification.deleteTargets.length,
  consumerCount: registry?.consumers.length ?? undefined,
  classificationPath: resolveDeliverable(classificationUri),
})}\n`);
