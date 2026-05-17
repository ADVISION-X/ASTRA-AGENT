/**
 * MuscleMemory System Manual — builds AI-readable ability handbook.
 *
 * Governance:
 *   - Only formats allowedForAiActionPlan=true atomic registered abilities.
 *   - Does not decide business actions, filter flows, or construct execution plans.
 *   - Output is consumed by AI prompt builders.
 */

import { createHash } from "node:crypto";

import { listAiVisibleAbilities, loadMuscleMemoryCatalog } from "./catalog.js";
import type { RegisteredAtomicAbility } from "./catalog.js";
import { resolveAiActionInputPolicy } from "../visual-mission/action-plan/action-field-policy.js";

function formatFieldList(fields: string[]): string {
  return fields.length > 0 ? fields.join(", ") : "(none)";
}

const PHYSICAL_SEMANTICS_BY_ACTION_CODE: Record<string, string> = {
  CAPTURE_SCREEN:
    "Takes one screenshot of the current browser viewport. It observes the page only; it does not click, type, scroll, navigate, like, comment, or save a product lead.",
  RENDER_COORDINATE_GRID_ONCE:
    "Creates a grid-labeled copy of an existing screenshot so later mouse actions can name visible cells. It does not interact with the webpage.",
  CAPTURE_GRID_REGION_ONCE:
    "Crops a rectangular region from an existing screenshot based on a grid cell. It observes saved pixels only; it does not interact with the webpage.",
  CALL_VISUAL_MISSION_JUDGE_ONCE:
    "Asks the AI to judge current visual evidence and propose registered atomic actions. It does not execute those actions.",
  LEFT_CLICK_GRID_CELL_ONCE:
    "Physically performs one left mouse click at the chosen gridCell/cellZone in the active browser viewport. Use it only when the intended action is naturally done by clicking a visible screen target.",
  DOUBLE_LEFT_CLICK_GRID_CELL:
    "Physically performs two left mouse clicks at the chosen gridCell/cellZone in the active browser viewport. Use it only for targets that require a double click.",
  RIGHT_CLICK_GRID_CELL_ONCE:
    "Physically performs one right mouse click at the chosen gridCell/cellZone in the active browser viewport. Use it only when opening a context menu is the intended action.",
  TYPE_APPROVED_TEXT_ONCE:
    "Types the supplied approvedText into the element that is already focused. It does not choose or click an input field and does not generate the text.",
  PRESS_APPROVED_KEY_ONCE:
    "Physically presses one approved keyboard key in the currently focused browser/page context. approvedKey='ArrowDown' means pressing the keyboard Down Arrow key once. approvedKey='L' means pressing the keyboard L key once; on short-video surfaces this is the platform shortcut for liking the currently focused video when the platform supports it. This is not a mouse click, not a comment action, and not an evidence-save action.",
  CLEAR_FOCUSED_INPUT_ONCE:
    "Clears text from the element that is already focused. It does not choose or click an input field.",
  SCROLL_BROWSER_VIEWPORT_ONCE:
    "Physically scrolls the current browser viewport by the provided scroll delta. It does not click a visible button and does not verify what content appears after scrolling.",
  OPEN_PLATFORM_ENTRY_ONCE:
    "Navigates the governed Chrome session to a registered platform entry URL supplied by the system. It does not invent URLs or perform page actions after navigation.",
  STOP_REVIEW_REQUIRED_ONCE:
    "Stops the current automated mission and marks it for human review. It does not click, type, scroll, save evidence, or move to the next video.",
  SAVE_RECORD_ONCE:
    "Appends a governed record to the forensics ledger. It does not interact with the webpage and does not decide product status by itself.",
  APPEND_ARTIFACT_ONCE:
    "Appends an existing file artifact reference to the forensics ledger. It does not capture a new screenshot or interact with the webpage.",
  READ_RECORD_ONCE:
    "Reads an existing forensics record. It observes stored data only and does not interact with the webpage.",
};

function resolvePhysicalSemantics(ability: RegisteredAtomicAbility): string {
  return PHYSICAL_SEMANTICS_BY_ACTION_CODE[ability.actionCode]
    ?? "Executes exactly the registered atomic child capability described above; it does not perform any second hidden business action.";
}

function buildAbilityBlock(ability: RegisteredAtomicAbility): string {
  const inputPolicy = resolveAiActionInputPolicy(ability);
  return [
    `actionCode: ${ability.actionCode}`,
    "type: atomic",
    `binding: ${ability.abilityGroupId}/${ability.childCapabilityId}`,
    `displayName: ${ability.displayName}`,
    `description: ${ability.description}`,
    `physicalSemantics: ${resolvePhysicalSemantics(ability)}`,
    `inputSchemaRef: ${ability.inputSchemaRef}`,
    `outputSchemaRef: ${ability.outputSchemaRef}`,
    `aiRequiredInput: ${formatFieldList(inputPolicy.aiRequiredInput)}`,
    `aiOptionalInput: ${formatFieldList(inputPolicy.aiOptionalInput)}`,
    `systemInjectedInput: ${formatFieldList(inputPolicy.systemInjectedInput)}`,
    `forbiddenInput: ${formatFieldList(inputPolicy.forbiddenInput)}`,
    `failurePolicy: ${ability.failurePolicy}`,
  ].join("\n");
}

function buildManualText(): string {
  return listAiVisibleAbilities().map((a) => buildAbilityBlock(a)).join("\n\n");
}

function buildManualRef(text: string): string {
  return `system-manual:${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

export function buildMuscleMemorySystemManual() {
  const text = buildManualText();
  return {
    systemManualRef: buildManualRef(text),
    catalogVersion: loadMuscleMemoryCatalog().catalogVersion,
    text,
    actions: listAiVisibleAbilities(),
  };
}
