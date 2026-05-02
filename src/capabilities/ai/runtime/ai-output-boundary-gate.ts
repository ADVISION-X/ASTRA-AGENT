import { AiForbiddenActionOutputFieldSchema } from "../schema.js";

const FORBIDDEN_ACTION_FIELDS = [
  "actionIntent",
  "platformAction",
  "executableCoordinate",
  "clickCommand",
  "scrollCommand",
  "openCommand",
  "forensicsWriteCommand",
  "mouseAction",
  "browserAction",
  "pageAction",
  "commandToExecute",
  "coordinateToClick",
] as const;

const FORBIDDEN_ACTION_ALIASES = [
  "action_intent",
  "platform_action",
  "executable_coordinate",
  "click_command",
  "scroll_command",
  "open_command",
  "mouse_click",
  "browser_open",
  "text_input",
  "input_text",
  "type_command",
  "paste_command",
  "press_key",
  "keyboard_action",
  "hover_command",
  "drag_command",
  "navigate_command",
  "navigation_command",
  "open_url",
  "open_page",
  "screenshot_command",
  "persist_evidence",
  "forensics_write",
  "dispatch_envelope",
  "nerve_bus_dispatch",
] as const;

const FORBIDDEN_ACTION_EXTENDED_FIELDS = [
  "textInput",
  "inputText",
  "typeCommand",
  "pasteCommand",
  "pressKey",
  "keyboardAction",
  "hoverCommand",
  "dragCommand",
  "navigateCommand",
  "navigationCommand",
  "openUrl",
  "openPage",
  "screenshotCommand",
  "persistEvidence",
  "forensicsWrite",
  "dispatchEnvelope",
  "nerveBusDispatch",
] as const;

const FORBIDDEN_OUTPUT_KEYS = new Set<string>([
  ...FORBIDDEN_ACTION_FIELDS,
  ...FORBIDDEN_ACTION_ALIASES,
  ...FORBIDDEN_ACTION_EXTENDED_FIELDS,
]);

function collectForbiddenFields(value: unknown, path: string[]): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenFields(item, [...path, String(index)]));
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const currentPath = [...path, key];
    const direct = FORBIDDEN_OUTPUT_KEYS.has(key) ? [`forbidden_output_field:${currentPath.join(".")}`] : [];
    return [...direct, ...collectForbiddenFields(nested, currentPath)];
  });
}

export function evaluateAiOutputBoundary(output: unknown): { decision: "allow" | "review_required" | "blocked"; reason: string | null; flags: string[] } {
  const schemaCheck = AiForbiddenActionOutputFieldSchema.safeParse(output);
  const flags = collectForbiddenFields(output, []);

  if (!schemaCheck.success) {
    flags.push("schema_level_action_output");
  }

  if (flags.length === 0) {
    return { decision: "allow", reason: null, flags: [] };
  }

  return {
    decision: "blocked",
    reason: "output_boundary_blocked",
    flags: [...new Set(flags)],
  };
}
