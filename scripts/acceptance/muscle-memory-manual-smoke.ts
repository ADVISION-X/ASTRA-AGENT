import { loadMuscleMemoryCatalog, isAiActionPlanAllowedActionCode } from "../../src/muscle-memory/catalog.js";
import { buildMuscleMemorySystemManual } from "../../src/muscle-memory/manual.js";
import { VisualMissionActionPlanOutputSchema } from "../../src/visual-mission/action-plan/ai-output.schema.js";
import { normalizeVisualMissionActionPlanOutput } from "../../src/visual-mission/action-plan/normalize-ai-output.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getActionBlock(text: string, actionCode: string): string | null {
  return text.split("\n\n").find((block) => block.includes(`actionCode: ${actionCode}`)) ?? null;
}

function buildBaseOutput() {
  return {
    schemaVersion: "visualMissionActionPlan.v1" as const,
    userIntentUnderstanding: { matched: true, summary: "manual smoke" },
    platform: "tiktok-web" as const,
    isTargetPlatform: true,
    surface: "for_you_video",
    isTargetFeed: true,
    pageStateDecision: "ready" as const,
    isProductVideo: true,
    productDecision: "product_yes" as const,
    confidence: 1,
    visibleProductTypes: ["smoke"],
    visualEvidence: ["visible target"],
    reason: "manual smoke",
    riskFlags: [],
    nonExecutableSummary: "manual smoke",
    nonExecutableClickTargets: [],
  };
}

function buildOutputActionPlan(action: {
  actionCode: string;
  required: boolean;
  reason: string;
  input?: Record<string, unknown>;
}) {
  return VisualMissionActionPlanOutputSchema.parse({
    ...buildBaseOutput(),
    actions: [action],
  });
}

function expectSchemaReject(action: {
  actionCode: string;
  required: boolean;
  reason: string;
  input?: Record<string, unknown>;
}, message: string) {
  const result = VisualMissionActionPlanOutputSchema.safeParse({
    ...buildBaseOutput(),
    actions: [action],
  });
  assert(!result.success, message);
}

function decodeOutput(_output: ReturnType<typeof buildOutputActionPlan>) {
  // decodeVisualMissionActionPlan was removed in orchestration rebuild
  return { status: "skipped" as const, actions: [] };

}

// ─── Load catalog & manual ────────────────────────────────────────────────────

const catalog = loadMuscleMemoryCatalog();
const manual = buildMuscleMemorySystemManual();

// ─── 1. Catalog version check ─────────────────────────────────────────────────

assert(catalog.catalogVersion === "2026-05-11.atomic-registry", "Catalog version must be 2026-05-11.atomic-registry");

// ─── 2. Forbidden action codes must be absent ────────────────────────────────

const FORBIDDEN_CODES = ["CLICK_CELL", "CLICK_BROWSER_COORDINATE", "SAVE_LEAD", "PRESS_KEY", "PRESS_NAVIGATION_KEY", "STOP_REVIEW_REQUIRED"];
for (const code of FORBIDDEN_CODES) {
  assert(!catalog.entries.some((e) => e.actionCode === code), `Forbidden action code "${code}" must not exist in catalog`);
}

// ─── 3. Required AI-visible atomic click actions ──────────────────────────────

assert(isAiActionPlanAllowedActionCode("LEFT_CLICK_GRID_CELL_ONCE"), "LEFT_CLICK_GRID_CELL_ONCE must be AI-visible");
assert(isAiActionPlanAllowedActionCode("DOUBLE_LEFT_CLICK_GRID_CELL"), "DOUBLE_LEFT_CLICK_GRID_CELL must be AI-visible");
assert(isAiActionPlanAllowedActionCode("RIGHT_CLICK_GRID_CELL_ONCE"), "RIGHT_CLICK_GRID_CELL_ONCE must be AI-visible");

// ─── 4. Forbidden action codes must not be AI-visible ────────────────────────

assert(!isAiActionPlanAllowedActionCode("CLICK_CELL"), "CLICK_CELL must not be AI-visible");
assert(!isAiActionPlanAllowedActionCode("CLICK_BROWSER_COORDINATE"), "CLICK_BROWSER_COORDINATE must not be AI-visible");
assert(!isAiActionPlanAllowedActionCode("PRESS_KEY"), "PRESS_KEY must not be AI-visible");
assert(!isAiActionPlanAllowedActionCode("PRESS_NAVIGATION_KEY"), "PRESS_NAVIGATION_KEY must not be AI-visible");

// ─── 5. Manual does not expose hidden actions ─────────────────────────────────

assert(!manual.text.includes("actionCode: PRESS_KEY"), "Manual must not expose PRESS_KEY");
assert(!manual.text.includes("actionCode: CLICK_BROWSER_COORDINATE"), "Manual must not expose CLICK_BROWSER_COORDINATE");
assert(!manual.text.includes("actionCode: CLICK_CELL"), "Manual must not expose CLICK_CELL");

// ─── 6. AI-visible entries have abilityGroupId + childCapabilityId ─────────────

const aiVisible = catalog.entries.filter((e) => e.allowedForAiActionPlan);
assert(aiVisible.length > 0, "At least one AI-visible action must exist in catalog");
for (const entry of aiVisible) {
  assert(typeof entry.abilityGroupId === "string" && entry.abilityGroupId.length > 0, `AI-visible entry ${entry.actionCode} must have abilityGroupId`);
  assert(typeof entry.childCapabilityId === "string" && entry.childCapabilityId.length > 0, `AI-visible entry ${entry.actionCode} must have childCapabilityId`);
}

// ─── 7. Manual blocks for AI-visible atomic click actions ─────────────────────

const leftClickBlock = getActionBlock(manual.text, "LEFT_CLICK_GRID_CELL_ONCE");
const doubleClickBlock = getActionBlock(manual.text, "DOUBLE_LEFT_CLICK_GRID_CELL");
const rightClickBlock = getActionBlock(manual.text, "RIGHT_CLICK_GRID_CELL_ONCE");

assert(leftClickBlock?.includes("aiRequiredInput: gridCell"), "LEFT_CLICK_GRID_CELL_ONCE manual must require gridCell");
assert(doubleClickBlock?.includes("aiRequiredInput: gridCell"), "DOUBLE_LEFT_CLICK_GRID_CELL manual must require gridCell");
assert(rightClickBlock?.includes("aiRequiredInput: gridCell"), "RIGHT_CLICK_GRID_CELL_ONCE manual must require gridCell");

// ─── 8. Schema accepts valid atomic click actions ─────────────────────────────

const validLeftClick = buildOutputActionPlan({
  actionCode: "LEFT_CLICK_GRID_CELL_ONCE",
  required: true,
  reason: "click target visible at D42",
  input: { gridCell: "D42" },
});
const validDoubleClick = buildOutputActionPlan({
  actionCode: "DOUBLE_LEFT_CLICK_GRID_CELL",
  required: true,
  reason: "double click target at K50",
  input: { gridCell: "K50" },
});

// ─── 9. Schema rejects forbidden action codes ─────────────────────────────────

expectSchemaReject(
  { actionCode: "PRESS_KEY", required: true, reason: "direct key", input: { key: "Enter" } },
  "PRESS_KEY must be rejected as a root AI actionCode",
);
expectSchemaReject(
  { actionCode: "CLICK_BROWSER_COORDINATE", required: true, reason: "direct coordinate", input: { x: 10, y: 20 } },
  "CLICK_BROWSER_COORDINATE must be rejected as a root AI actionCode",
);

// ─── 10. Decoder produces execution actions ───────────────────────────────────

const decodedLeft = decodeOutput(validLeftClick);
assert(decodedLeft.actions.length > 0, "LEFT_CLICK_GRID_CELL_ONCE must produce at least one execution action");

const decodedDouble = decodeOutput(validDoubleClick);
assert(decodedDouble.actions.length > 0, "DOUBLE_LEFT_CLICK_GRID_CELL must produce at least one execution action");

// ─── 11. No forbidden fields in any catalog entry ────────────────────────────

const FORBIDDEN_FIELDS = ["requiresPageStateRef", "requiresPostActionVerification", "internalOnly", "productPresenceAiResultRef"];
const catalogStr = JSON.stringify(catalog);
for (const field of FORBIDDEN_FIELDS) {
  assert(!catalogStr.includes(field), `Forbidden field "${field}" must not appear in catalog`);
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  catalogVersion: catalog.catalogVersion,
  totalEntries: catalog.entries.length,
  aiVisibleCount: aiVisible.length,
  aiVisibleActionCodes: aiVisible.map((e) => e.actionCode),
}, null, 2)}\n`);
