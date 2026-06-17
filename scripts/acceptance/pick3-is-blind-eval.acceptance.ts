import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { createPick3BlindImages } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import {
  PICK3_LOTTERY_TYPE,
  PICK3_OFFICIAL_SOURCE,
  type Pick3Draw,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const fromRepo = (path: string): string => resolve(repoRoot, path);
const readRepoText = (path: string): string => readFileSync(fromRepo(path), "utf8");

const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const inspectorPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";

assert.equal(existsSync(fromRepo(lawPath)), true);
assert.equal(existsSync(fromRepo(blueprintPath)), true);
assert.equal(existsSync(fromRepo(manifestPath)), true);
assert.equal(existsSync(fromRepo(inspectorPath)), true);
assert.equal(existsSync(fromRepo(misplacedLawPath)), false);

const lawText = readRepoText(lawPath);
const blueprintText = readRepoText(blueprintPath);

for (const token of [
  "```apex-law",
  "\"capabilityDomain\": \"pick3-is-blind-eval\"",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1",
]) {
  assert.equal(lawText.includes(token), true, `law must include ${token}`);
}

for (const token of [
  "https://www.theuaelottery.ae/lottery/pick3",
  "https://www.theuaelottery.ae/lottery/pick3/results",
  "lotteryType=72",
  "command=660201",
  "command=660104",
  "command=660301",
  "260616",
  "4 2 7",
  "L=80",
  "no Chart #",
  "no point-count text",
  "PredictionSeal",
  "failure_replay",
  "not_valid_for_accuracy",
  "model_id",
  "temperature",
  "image_detail",
  "system_prompt_version_id",
  "business_prompt_version_id",
  "confidence_is_probability",
  "abstain",
  "coverageRate",
  "one-position baseline = 50%",
  "three-position combination baseline = 12.5%",
  "three-position hit rate > 25%",
  "approximate stable per-position hit rate > 63%",
  "confidence is not probability",
]) {
  assert.equal(blueprintText.includes(token), true, `blueprint must include ${token}`);
}

const latestPayload = {
  data: {
    lotteryType: 72,
    includeSelf: 1,
    isDesc: 1,
    prePhases: 10,
    alreadyDrawn: 1,
  },
};
const encoded = Buffer.from(JSON.stringify(latestPayload), "utf8").toString("base64");
assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), latestPayload);

const officialRow = {
  phase: "260616",
  result: [{ key: "pick3", data: ["4", "2", "7"] }],
};
const nums = officialRow.result[0]?.data ?? [];
assert.deepEqual({
  drawNo: officialRow.phase,
  hundreds: Number(nums[0]),
  tens: Number(nums[1]),
  ones: Number(nums[2]),
}, {
  drawNo: "260616",
  hundreds: 4,
  tens: 2,
  ones: 7,
});

assert.equal(0.5, 1 / 2);
assert.equal(0.125, 1 / 8);
assert.ok(Math.pow(0.63, 3) < 0.251);
assert.ok(Math.pow(0.64, 3) > 0.25);

const buildDraw = (index: number): Pick3Draw => {
  const hundreds = index % 10;
  const tens = (index * 3) % 10;
  const ones = (index * 7) % 10;
  const phase = String(260000 + index);
  const rawJson = JSON.stringify({ phase, result: [{ key: "pick3", data: [String(hundreds), String(tens), String(ones)] }] });
  return {
    source: PICK3_OFFICIAL_SOURCE,
    lotteryType: PICK3_LOTTERY_TYPE,
    phase,
    expectedPrizeTime: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T21:30:00+04:00`,
    expectedPrizeTimestamp: String(1_800_000_000_000 + index),
    resultText: `${hundreds} ${tens} ${ones}`,
    hundreds,
    tens,
    ones,
    totalWinningBetCount: null,
    resultDetailJson: "[]",
    rawJson,
    rawHash: `hash-${phase}`,
  };
};

const tempDataDir = mkdtempSync(resolve(tmpdir(), "pick3-is-blind-eval-"));
const storage = openPick3Storage(tempDataDir);
try {
  const draws = Array.from({ length: 100 }, (_, index) => buildDraw(index + 1));
  const firstUpsert = storage.upsertDraws(draws);
  assert.equal(firstUpsert.inserted, 100);
  assert.equal(firstUpsert.updated, 0);
  const secondUpsert = storage.upsertDraws(draws);
  assert.equal(secondUpsert.inserted, 0);
  assert.equal(secondUpsert.updated, 0);
  assert.equal(storage.listDrawsAscending().length, 100);

  const targets = storage.listTargetDraws({ batchSize: 2 });
  assert.equal(targets.length, 2);
  const artifactDir = resolve(tempDataDir, "artifacts", "acceptance-batch");
  const images = await createPick3BlindImages({
    artifactDir,
    batchId: "acceptance-batch",
    drawsAscending: storage.listDrawsAscending(),
    positions: ["hundreds", "tens", "ones"],
    targetDraws: targets,
  });
  assert.equal(images.length, 6);
  for (const image of images) {
    assert.equal(existsSync(image.imagePath), true);
    assert.ok(statSync(image.imagePath).size > 1000);
    assert.equal(image.imagePath.includes(image.targetPhase), false);
    assert.equal(image.imagePath.includes(`answer_${image.answerDigit}`), false);
    assert.equal(image.imagePath.includes(`/${image.position}/`), false);
    assert.equal(image.imagePath.includes("Chart"), false);
    assert.equal(image.imagePath.includes("points"), false);
  }
} finally {
  storage.close();
}

console.log("pick3-is-blind-eval acceptance passed");
