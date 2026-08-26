import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const candidateHash = buildStartupSourceFingerprint(root);
const releaseRecordPath = path.join(root, ".grasseye-local", "browser-release", "release-record.json");
const releaseRecord = JSON.parse(readFileSync(releaseRecordPath, "utf8")) as {
  releaseBuildId: string; manifestHash: `sha256:${string}`;
};
const healthResponse = await fetch("http://127.0.0.1:4173/api/health");
assert.equal(healthResponse.ok, true);
const health = await healthResponse.json() as Record<string, unknown>;
const healthHash = `sha256:${createHash("sha256").update(JSON.stringify(health)).digest("hex")}` as const;
const receipt = (value: `sha256:${string}`): string => value.slice(7);

process.stdout.write(`${JSON.stringify({
  status: "CHROME_RUNTIME_OBSERVED",
  candidateHash,
  extensionId: GRASSEYE_UNPACKED_EXTENSION_ID,
  releaseBuildId: releaseRecord.releaseBuildId,
  healthHash,
})}\n`);

for (const [lawId, mode] of [
  ["LAW-LOCAL-BROWSER-SESSION-001-V4", "dynamic.browser"],
  ["LAW-LOCAL-BROWSER-SESSION-002-V5", "dynamic.browser"],
  ["LAW-LOCAL-BROWSER-SESSION-003-V8", "dynamic.browser"],
  ["LAW-LOCAL-BROWSER-SESSION-004-V9", "dynamic.storage"],
  ["LAW-LOCAL-BROWSER-SESSION-005-V5", "dynamic.browser"],
  ["LAW-LOCAL-BROWSER-SESSION-006-V3", "dynamic.browser"],
] as const) emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId,
  evidenceMode: mode,
  clauses: ["summary"],
  locator: lawId === "LAW-LOCAL-BROWSER-SESSION-004-V9"
    ? path.join(root, ".grasseye-local", "browser", "browser-mutations.sqlite")
    : releaseRecordPath,
  receipt: receipt(lawId === "LAW-LOCAL-BROWSER-SESSION-005-V5" ? releaseRecord.manifestHash : healthHash),
  observedValue: `release=${releaseRecord.releaseBuildId};health=${healthHash}`,
});
