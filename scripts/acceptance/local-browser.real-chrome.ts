import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const candidateHash = buildStartupSourceFingerprint(root);
const journalPath = path.join(root, ".grasseye-local", "browser", "proof-events.ndjson");
const releaseRecord = JSON.parse(readFileSync(path.join(
  root,
  ".grasseye-local",
  "browser-release",
  "release-record.json",
), "utf8")) as { releaseBuildId: string };
const envelopes = readBrowserProofJournal(journalPath);
const now = Date.now();
const maxAgeMs = 30 * 60 * 1_000;
const authorityHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const recent = envelopes.filter(({ event }) =>
  event.candidateHash === candidateHash
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
