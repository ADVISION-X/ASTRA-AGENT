import assert from "node:assert/strict";
import test from "node:test";

import { recordAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";

import { buildWorkbenchAiInputRefs } from "./workbench-nerve-bus-ai-input-proof-support.js";

test("buildWorkbenchAiInputRefs falls back to ability-result artifact storage", () => {
  recordAbilityResultProofSummary("coordinate-grid:visual-1", {
    artifactStorageRef: "/tmp/grasseye/coordinate-grid-visual-1.png",
    sourceStorageRef: "/tmp/grasseye/original-visual-1.png",
  });

  const refs = buildWorkbenchAiInputRefs(
    {
      aiInputRefs: ["coordinate-grid:visual-1"],
    },
    {
      documentType: "nerve-bus.test-payload",
      documentRef: "payload:test",
      summary: "visual mission input",
      entityRefs: [],
      evidenceRefs: [],
      contentBlocks: [],
    },
  );

  assert.equal(refs[0]?.id, "coordinate-grid:visual-1");
  assert.equal(refs[0]?.filePath, "/tmp/grasseye/coordinate-grid-visual-1.png");
});
