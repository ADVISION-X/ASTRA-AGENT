import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string): string => readFileSync(file, "utf8");
const parse = <T>(file: string): T => JSON.parse(read(file)) as T;

test("V6 law, blueprint, pin, generator and runtime form one exact active chain", () => {
  const law = read(".github/instructions/agent-rules/功能法案.md");
  const blueprint = read("docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md");
  const pin = parse<{
    version: number;
    contract: {
      contractId: string;
      version: number;
      providerSpecRef: string;
      providerCommitSha: string;
    };
  }>("docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json");
  const generatedManifest = parse<{ protocol_version: string; schema_version: string }>(
    "src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.manifest.json",
  );
  const generatedValidator = read("src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.validator.ts");
  const generator = read("scripts/acceptance/generate-xuanxue-ai-production-v6-validator.mjs");
  const cloudContract = read("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.ts");
  const cloudClient = read("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts");
  const cloudEnrollment = read("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts");
  const workerSession = read("src/plugins/xuanxue-ai-production/xuanxue-ai-production-worker-session.ts");
  const packageJson = parse<{ scripts: Record<string, string> }>("package.json");

  assert.match(law, /LAW-XUANXUE-AI-PRODUCTION-001-V7/u);
  assert.match(law, /summary.*xuanxue-ai-production-v6/u);
  assert.match(blueprint, /状态：active V6 terminal/u);
  assert.match(blueprint, /xuanxue-ai-production-v6\.pin\.spec\.json/u);
  assert.equal(pin.version, 6);
  assert.equal(pin.contract.contractId, "ai-acceptance.xuanxue-ai-production-v6");
  assert.equal(pin.contract.version, 6);
  assert.equal(pin.contract.providerSpecRef, "docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json");
  assert.match(pin.contract.providerCommitSha, /^[a-f0-9]{40}$/u);
  assert.equal(generatedManifest.protocol_version, "xuanxue-ai-production-v6");
  assert.equal(generatedManifest.schema_version, "xuanxue-ai-production-contract-manifest.v6");
  assert.match(generatedValidator, new RegExp(`Provider: ADVISION-X/xuanxue-web@${pin.contract.providerCommitSha}:`, "u"));
  assert.match(generatedValidator, /protocol_version: "xuanxue-ai-production-v6"/u);
  assert.match(generator, /xuanxue-ai-production-v6\.pin\.spec\.json/u);
  assert.match(generator, /xuanxue-ai-production-v6\.validator\.ts/u);
  assert.match(cloudContract, /XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION[\s\S]*"xuanxue-ai-production-v6" as const/u);
  for (const runtime of [cloudClient, cloudEnrollment, workerSession]) {
    assert.match(runtime, /\/internal\/ai-production\/v6\//u);
    assert.doesNotMatch(runtime, /\/internal\/ai-production\/(?:v5|control)\//u);
  }
  assert.match(packageJson.scripts["acceptance:xuanxue-ai-production"] ?? "", /xuanxue-ai-production:v6:validator:check/u);
  assert.equal(packageJson.scripts["xuanxue-ai-production:v6:validator:generate"],
    "node scripts/acceptance/generate-xuanxue-ai-production-v6-validator.mjs");
  assert.equal(packageJson.scripts["xuanxue-ai-production:v6:validator:check"],
    "node scripts/acceptance/generate-xuanxue-ai-production-v6-validator.mjs --check");
  assert.throws(() => readFileSync("docs/specs/xuanxue-ai-production/xuanxue-ai-production-control.pin.spec.json"),
    /ENOENT/u);
});

test("credential reader fails closed on retired protocol while preserving diagnostic Shell recovery", () => {
  const credential = read("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-credential.ts");
  const server = read("src/app/server.ts");
  const readiness = read("scripts/startup/lib/service-readiness.mjs");
  const launcher = read("scripts/startup/launch-grasseye.mjs");
  assert.match(credential, /XUANXUE_AI_PRODUCTION_CREDENTIAL_REENROLLMENT_REQUIRED/u);
  assert.match(credential, /raw\.protocol_version !== XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION/u);
  assert.match(server, /diagnostic shell is independently available/iu);
  assert.match(server, /execution dependencies blocked/iu);
  assert.doesNotMatch(readiness, /healthReport\.status !== "healthy"/u);
  assert.match(launcher, /APP_SHELL_DIAGNOSTIC_READY/u);
  assert.match(launcher, /execution dependencies remain blocked/u);
});
