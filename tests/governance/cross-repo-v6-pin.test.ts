import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const WEBSITE = "/Users/nexgen/Documents/xuanxue-web";
const PIN_PATH = "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json";

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]));
  }
  return value;
};
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

test("AGENT V6 consumer pin binds the committed website provider contract", () => {
  const pin = JSON.parse(readFileSync(PIN_PATH, "utf8")) as {
    contract: {
      providerCommitSha: string;
      providerSpecRef: string;
      contractSha256: string;
      contractId: string;
      version: number;
      providerRepo: string;
      providerDomain: string;
    };
  };
  const providerBytes = execFileSync("git", ["show", `${pin.contract.providerCommitSha}:${pin.contract.providerSpecRef}`], { cwd: WEBSITE });
  const provider = JSON.parse(providerBytes.toString("utf8")) as { contract: Record<string, unknown> };
  const canonicalContract = `${JSON.stringify(canonical(provider.contract), null, 2)}\n`;
  assert.equal(sha256(canonicalContract), pin.contract.contractSha256);
  assert.equal(provider.contract.contractId, pin.contract.contractId);
  assert.equal(provider.contract.version, pin.contract.version);
  assert.equal(provider.contract.providerRepo, pin.contract.providerRepo);
  assert.equal(provider.contract.providerDomain, pin.contract.providerDomain);
});
