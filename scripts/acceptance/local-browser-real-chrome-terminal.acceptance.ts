import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GRASSEYE_BROWSER_EXTENSION_ID } from "../../src/lib/browser/release/cws-extension-release-identity.js";

type RealChromeEvidence = Readonly<{
  status: "CHROME_VERIFIED";
  extensionId: string;
  extensionVersion: string;
  releaseMode: "cws-reviewed";
  workbenchUrl: string;
  checks: Readonly<{
    pageChannelConnected: true;
    operatorTargetClaimed: true;
    permittedCommandCompleted: true;
    disconnectRevokedAuthority: true;
  }>;
  evidenceRefs: readonly string[];
}>;

const evidenceArgument = process.argv.indexOf("--evidence");

const fail = (reason: string): never => {
  process.stderr.write(`${JSON.stringify({ status: "NOT_PRODUCTION_VERIFIED", reason })}\n`);
  process.exit(1);
};

if (evidenceArgument === -1 || !process.argv[evidenceArgument + 1]) {
  fail("Real Chrome evidence is required. Run the exact installed CWS MV3 to Workbench page journey, save its evidence JSON, then pass --evidence <path>.");
}

try {
  const evidencePath = resolve(process.argv[evidenceArgument + 1]!);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as RealChromeEvidence;
  assert.equal(evidence.status, "CHROME_VERIFIED");
  assert.equal(evidence.extensionId, GRASSEYE_BROWSER_EXTENSION_ID);
  assert.notEqual(evidence.extensionVersion, "0.1.1");
  assert.equal(evidence.releaseMode, "cws-reviewed");
  assert.equal(evidence.workbenchUrl, "http://127.0.0.1:4173/");
  assert.deepEqual(evidence.checks, {
    pageChannelConnected: true,
    operatorTargetClaimed: true,
    permittedCommandCompleted: true,
    disconnectRevokedAuthority: true,
  });
  assert.ok(Array.isArray(evidence.evidenceRefs) && evidence.evidenceRefs.length > 0);
  process.stdout.write(`${JSON.stringify({ status: "CHROME_VERIFIED", extensionId: evidence.extensionId, extensionVersion: evidence.extensionVersion })}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
