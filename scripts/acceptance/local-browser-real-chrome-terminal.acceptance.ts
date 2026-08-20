import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assertReleaseSignature,
  canonicalReleaseIdentityPayload,
  sha256,
  type ReleaseSignatureEnvelope,
} from "../../src/lib/browser/release/release-identity.js";
import { parseArguments, readJson, resolveDeliverable } from "./local-browser-plan-harness.self-test.js";

type JsonRecord = Readonly<Record<string, unknown>>;
type ArtifactSet = JsonRecord & Readonly<{ artifactSetHash: string }>;
type ActivationTuple = JsonRecord & Readonly<{ artifactSetHash: string }>;
type ReleaseSecurityPolicy = JsonRecord & Readonly<{ currentTupleHash: string }>;
type ReleaseIdentitySignature = JsonRecord & Readonly<{
  signature: ReleaseSignatureEnvelope;
}>;
type ConstructedCandidate = JsonRecord & Readonly<{ candidateHash: string }>;
type TerminalCheck = Readonly<{
  positive: "CONFIRMED";
  negative: "REJECTED";
  terminal: "CONFIRMED";
  bounded: true;
  evidenceRefs: readonly string[];
}>;
type BrowserResult = Readonly<{
  browser: string;
  chromeVersion: string;
  status: "CHROME_VERIFIED";
  checks: Readonly<Record<string, TerminalCheck>>;
}>;
type RealChromeMatrix = JsonRecord & Readonly<{
  candidateHash: string;
  artifactSetHash: string;
  activationTupleHash: string;
  releaseSecurityPolicyHash: string;
  signature: ReleaseSignatureEnvelope;
  results: readonly BrowserResult[];
}>;

const terminalChecks = [
  "profile_process_policy",
  "authority_authentication",
  "exact_target",
  "file_artifact",
  "stream",
  "update_rollback",
] as const;

const args = parseArguments(process.argv.slice(2));
const requiredArgument = (name: string): string => {
  const value = args.get(name);
  if (typeof value !== "string") throw new Error(`${name} is required.`);
  return value;
};
const recordHash = (uri: string): string => sha256(readFileSync(resolveDeliverable(uri)));
const asRecord = (value: unknown, label: string): JsonRecord => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be a JSON object.`);
  return value as JsonRecord;
};
const nonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  if (value.length === 0) throw new Error(`${label} must not be empty.`);
  return value;
};

const verifyTerminalCheck = (check: unknown, browser: string, name: string): void => {
  const value = asRecord(check, `${browser}.${name}`) as TerminalCheck;
  assert.equal(value.positive, "CONFIRMED", `${browser}.${name} positive terminal is not confirmed.`);
  assert.equal(value.negative, "REJECTED", `${browser}.${name} negative case is not rejected.`);
  assert.equal(value.terminal, "CONFIRMED", `${browser}.${name} terminal state is not confirmed.`);
  assert.equal(value.bounded, true, `${browser}.${name} has no bounded completion proof.`);
  assert.ok(Array.isArray(value.evidenceRefs) && value.evidenceRefs.length > 0
    && value.evidenceRefs.every((reference) => typeof reference === "string" && reference.length > 0),
  `${browser}.${name} must retain non-empty evidence references.`);
};

const artifactIdentityHash = (artifact: ArtifactSet): string => {
  const files = artifact.files;
  assert.ok(Array.isArray(files) && files.length > 0, "ArtifactSet must include immutable file identities.");
  for (const file of files) {
    const record = asRecord(file, "ArtifactSet file identity");
    nonEmptyString(record.path, "ArtifactSet file path");
    assert.match(nonEmptyString(record.sha256, "ArtifactSet file hash"), /^sha256:[a-f0-9]{64}$/u);
  }
  return sha256(JSON.stringify(files));
};

const main = (): void => {
  const artifactUri = requiredArgument("--artifact");
  const tupleUri = requiredArgument("--tuple");
  const policyUri = requiredArgument("--security-policy");
  const signatureUri = requiredArgument("--identity-signature");
  const matrixUri = requiredArgument("--matrix");
  const candidateUri = requiredArgument("--constructed-candidate");
  const browsers = requiredArgument("--browsers").split(",").filter(Boolean);
  assert.deepEqual(browsers, ["stable", "cft"], "Real Chrome terminal proof requires exactly stable,cft in order.");
  assert.equal(args.has("--require-tuple-artifact-match"), true, "Tuple/artifact identity enforcement is required.");
  assert.equal(args.has("--require-security-policy-hash"), true, "Security-policy identity enforcement is required.");
  assert.equal(args.has("--require-positive-negative-terminal-bounds"), true, "Positive/negative bounded terminal enforcement is required.");

  const artifact = asRecord(readJson<ArtifactSet>(artifactUri), "artifact") as ArtifactSet;
  const tuple = asRecord(readJson<ActivationTuple>(tupleUri), "tuple") as ActivationTuple;
  const policy = asRecord(readJson<ReleaseSecurityPolicy>(policyUri), "security policy") as ReleaseSecurityPolicy;
  const signature = asRecord(readJson<ReleaseIdentitySignature>(signatureUri), "release identity signature") as ReleaseIdentitySignature;
  const matrix = asRecord(readJson<RealChromeMatrix>(matrixUri), "real Chrome matrix") as RealChromeMatrix;
  const candidate = asRecord(readJson<ConstructedCandidate>(candidateUri), "constructed candidate") as ConstructedCandidate;
  const artifactSetHash = nonEmptyString(artifact.artifactSetHash, "artifact.artifactSetHash");
  const candidateHash = nonEmptyString(candidate.candidateHash, "constructed candidate hash");
  const artifactDocumentHash = recordHash(artifactUri);
  const candidateDocumentHash = recordHash(candidateUri);
  const tupleHash = recordHash(tupleUri);
  const policyHash = recordHash(policyUri);

  assert.equal(artifactSetHash, artifactIdentityHash(artifact), "ArtifactSet identity must equal the exact immutable file manifest.");
  assert.equal(tuple.artifactSetHash, artifactSetHash, "ActivationTuple must bind the ArtifactSet exactly.");
  assert.equal(policy.currentTupleHash, tupleHash, "ReleaseSecurityPolicy must bind the exact ActivationTuple bytes.");
  const releasePayload = canonicalReleaseIdentityPayload({
    artifactDocumentHash,
    artifactSetHash,
    candidateHash,
    candidateDocumentHash,
    activationTupleHash: tupleHash,
    releaseSecurityPolicyHash: policyHash,
  });
  assertReleaseSignature({ envelope: signature.signature, payload: releasePayload });
  const { signature: matrixSignature, ...matrixEvidence } = matrix;
  const matrixEvidenceHash = sha256(JSON.stringify(matrixEvidence));
  assert.deepEqual({
    candidateHash: matrix.candidateHash,
    artifactSetHash: matrix.artifactSetHash,
    activationTupleHash: matrix.activationTupleHash,
    releaseSecurityPolicyHash: matrix.releaseSecurityPolicyHash,
  }, {
    candidateHash,
    artifactSetHash,
    activationTupleHash: tupleHash,
    releaseSecurityPolicyHash: policyHash,
  }, "Real Chrome matrix must bind the same constructed candidate and release inputs.");
  assertReleaseSignature({
    envelope: matrixSignature,
    payload: canonicalReleaseIdentityPayload({ ...JSON.parse(releasePayload) as Record<string, string>, matrixEvidenceHash }),
  });
  assert.ok(Array.isArray(matrix.results), "Real Chrome matrix results are required.");
  assert.deepEqual(matrix.results.map((result) => result.browser), browsers, "Stable and CfT must both have one ordered result.");
  for (const result of matrix.results) {
    assert.equal(result.status, "CHROME_VERIFIED", `${result.browser} was not verified in real Chrome.`);
    nonEmptyString(result.chromeVersion, `${result.browser}.chromeVersion`);
    for (const checkName of terminalChecks) verifyTerminalCheck(result.checks?.[checkName], result.browser, checkName);
  }

  process.stdout.write(`${JSON.stringify({
    status: "CHROME_VERIFIED",
    candidateHash,
    artifactSetHash,
    activationTupleHash: tupleHash,
    releaseSecurityPolicyHash: policyHash,
    browsers,
  })}\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    status: "NOT_PRODUCTION_VERIFIED",
    reason: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exitCode = 1;
}
