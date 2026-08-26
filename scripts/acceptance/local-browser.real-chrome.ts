import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const candidateHash = buildStartupSourceFingerprint(root);
const journalPath = path.join(root, ".grasseye-local", "browser", "proof-events.ndjson");
const releaseRecordPath = path.join(
  root,
  ".grasseye-local",
  "browser-release",
  "release-record.json",
);
const releaseRecord = JSON.parse(readFileSync(releaseRecordPath, "utf8")) as {
  releaseBuildId: string; manifestHash: `sha256:${string}`;
};
const envelopes = readBrowserProofJournal(journalPath);
const now = Date.now();
const maxAgeMs = 30 * 60 * 1_000;
const authorityHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const nativeReceipt = (value: `sha256:${string}`): string => value.slice("sha256:".length);
const recent = envelopes.filter(({ event }) =>
  event.eventType !== "RECOVERY"
  && event.candidateHash === candidateHash
  && now - Date.parse(event.recordedAt) >= 0
  && now - Date.parse(event.recordedAt) <= maxAgeMs);

const authenticated = recent.find(({ event }) => event.eventType === "LIFECYCLE"
  && event.phase === "AUTHENTICATED"
  && event.extensionId === GRASSEYE_UNPACKED_EXTENSION_ID
  && event.releaseBuildId === releaseRecord.releaseBuildId
  && typeof event.authorityRefHash === "string");
assert.ok(authenticated?.event.eventType === "LIFECYCLE");
const authenticatedIndex = recent.indexOf(authenticated);
const authorityRefHash = authenticated.event.authorityRefHash;
const claimed = recent.find(({ event }, index) => index > authenticatedIndex
  && event.eventType === "LIFECYCLE"
  && event.phase === "TARGET_CLAIMED"
  && event.authorityRefHash === authorityRefHash
  && Boolean(event.targetRef)
  && Boolean(event.documentRef));
assert.ok(claimed);
const claimedIndex = recent.indexOf(claimed);
const completed = recent.find(({ event }, index) => index > claimedIndex
  && event.eventType === "COMMAND"
  && event.phase === "COMPLETED"
  && authorityHash(event.authorityRef) === authorityRefHash
  && claimed.event.eventType === "LIFECYCLE"
  && event.targetRef === claimed.event.targetRef
  && event.documentRef === claimed.event.documentRef
  && typeof event.resultHash === "string"
  && Number.isInteger(event.transportSequence)
  && Number.isInteger(event.permitSequence));
assert.ok(completed);
assert.ok(completed.event.eventType === "COMMAND" && completed.event.resultHash);
const completedIndex = recent.indexOf(completed);
const revoked = recent.find(({ event }, index) => index > completedIndex
  && event.eventType === "LIFECYCLE"
  && event.phase === "AUTHORITY_REVOKED"
  && event.authorityRefHash === authorityRefHash);
assert.ok(revoked);

process.stdout.write(`${JSON.stringify({
  status: "CHROME_VERIFIED",
  candidateHash,
  extensionId: GRASSEYE_UNPACKED_EXTENSION_ID,
  authenticatedSequence: authenticated.sequence,
  claimedSequence: claimed.sequence,
  commandSequence: completed.sequence,
  revokedSequence: revoked.sequence,
})}\n`);
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-001-V4", evidenceMode: "dynamic.browser", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"],
  locator: `${journalPath}#sequence=${revoked.sequence}`, receipt: nativeReceipt(revoked.entryHash),
  observedValue: `authenticated=${authenticated.sequence};revoked=${revoked.sequence}` });
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-002-V5", evidenceMode: "dynamic.browser", clauses: ["forbidden:0","forbidden:1","forbidden:10","forbidden:11","forbidden:12","forbidden:13","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"],
  locator: `${journalPath}#sequence=${authenticated.sequence}`, receipt: nativeReceipt(authenticated.entryHash),
  observedValue: `extension=${GRASSEYE_UNPACKED_EXTENSION_ID};authority=${authorityRefHash}` });
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-003-V8", evidenceMode: "dynamic.browser", clauses: ["forbidden:0","forbidden:1","forbidden:10","forbidden:11","forbidden:12","forbidden:13","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"],
  locator: `${journalPath}#sequence=${completed.sequence}`, receipt: nativeReceipt(completed.entryHash),
  observedValue: `claim=${claimed.sequence};command=${completed.sequence}` });
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-004-V8", evidenceMode: "dynamic.storage", clauses: ["forbidden:10","forbidden:11","forbidden:12","forbidden:13","forbidden:14","forbidden:15","summary"],
  locator: `${journalPath}#sequence=${revoked.sequence}`, receipt: nativeReceipt(revoked.entryHash),
  observedValue: `durableChain=${authenticated.sequence},${claimed.sequence},${completed.sequence},${revoked.sequence}` });
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-005-V5", evidenceMode: "dynamic.browser", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","summary"],
  locator: releaseRecordPath, receipt: nativeReceipt(releaseRecord.manifestHash),
  observedValue: `release=${releaseRecord.releaseBuildId};candidate=${candidateHash}` });
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-006-V3", evidenceMode: "dynamic.browser", clauses: ["forbidden:0","summary"],
  locator: `${journalPath}#sequence=${completed.sequence}`, receipt: nativeReceipt(completed.event.resultHash),
  observedValue: `authorityHash=${authorityRefHash};resultHash=${completed.event.eventType === "COMMAND" ? completed.event.resultHash : "missing"}` });
