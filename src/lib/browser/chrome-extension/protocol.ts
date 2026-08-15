export const GRASSEYE_BROWSER_PROTOCOL_VERSION = "grasseye-browser-v1" as const;
export const GRASSEYE_NATIVE_HOST_NAME = "com.grasseye.browser" as const;

export type BrowserWireMutationClass =
  | "observation"
  | "idempotent_mutation"
  | "non_idempotent_mutation";

export type BrowserWireDomElementIdentity = {
  tagName?: string | undefined;
  type?: string | undefined;
  role?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  visibleText?: string | undefined;
  testId?: string | undefined;
};

export type BrowserWireCommand =
  | {
      kind: "acquire_target";
      url: string;
      reusePolicy: "reuse-exact-url" | "open-new-tab";
      excludedTabIds: readonly number[];
    }
  | { kind: "inspect_target"; tabId: number }
  | { kind: "navigate_target"; tabId: number; url: string }
  | { kind: "evaluate_target"; tabId: number; expression: string }
  | { kind: "click_target"; tabId: number; x: number; y: number; button: "left" | "right" | "middle"; clickCount: 1 | 2 }
  | { kind: "click_dom_target"; tabId: number; selector: string; identity: BrowserWireDomElementIdentity; expectedText?: string }
  | { kind: "fill_dom_target"; tabId: number; selector: string; identity: BrowserWireDomElementIdentity; approvedText: string; clearBeforeType: boolean }
  | { kind: "move_target"; tabId: number; x: number; y: number }
  | { kind: "scroll_target"; tabId: number; x: number; y: number; deltaX: number; deltaY: number }
  | { kind: "text_target"; tabId: number; action: "type-text" | "clear-input" | "press-key"; text?: string; key?: string }
  | { kind: "screenshot_target"; tabId: number }
  | { kind: "set_file_input_files"; tabId: number; selector: string; filePath: string }
  | { kind: "focus_target"; tabId: number; windowId: number }
  | { kind: "release_target"; tabId: number }
  | { kind: "close_target"; tabId: number };

export interface BrowserWireTargetDescriptor {
  readonly tabId: number;
  readonly windowId: number;
  readonly url: string;
  readonly title: string;
  readonly frameId: string;
  readonly loaderId: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deviceScaleFactor: number;
  readonly active: boolean;
  readonly windowFocused: boolean;
}

export type BrowserWireMessage =
  | { protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION; type: "extension_hello" }
  | { protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION; type: "controller_challenge"; nonce: string }
  | { protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION; type: "extension_authenticated"; nonce: string }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      type: "command";
      commandId: string;
      sequence: number;
      deadlineAt: number;
      mutationClass: BrowserWireMutationClass;
      expectedLoaderId?: string;
      command: BrowserWireCommand;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      type: "response";
      commandId: string;
      sequence: number;
      ok: boolean;
      result?: unknown;
      errorCode?: string;
      errorMessage?: string;
    };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isAcquireTargetCommand = (command: Record<string, unknown>): boolean =>
  typeof command.url === "string"
  && (command.reusePolicy === "reuse-exact-url" || command.reusePolicy === "open-new-tab")
  && Array.isArray(command.excludedTabIds)
  && command.excludedTabIds.every((tabId) => Number.isSafeInteger(tabId));

const isNavigateOrEvaluateCommand = (command: Record<string, unknown>): boolean =>
  command.kind === "navigate_target"
    ? typeof command.url === "string"
    : typeof command.expression === "string";

const isClickTargetCommand = (command: Record<string, unknown>): boolean =>
  isFiniteNumber(command.x) && isFiniteNumber(command.y)
  && (command.button === "left" || command.button === "right" || command.button === "middle")
  && (command.clickCount === 1 || command.clickCount === 2);

const isTextTargetCommand = (command: Record<string, unknown>): boolean =>
  (command.action === "type-text" || command.action === "clear-input" || command.action === "press-key")
  && (command.text === undefined || typeof command.text === "string")
  && (command.key === undefined || typeof command.key === "string");

const isDomElementIdentity = (value: unknown): value is BrowserWireDomElementIdentity => {
  if (!value || typeof value !== "object") return false;
  const identity = value as Record<string, unknown>;
  const keys = ["tagName", "type", "role", "ariaLabel", "labelText", "placeholder", "name", "id", "visibleText", "testId"];
  return keys.some((key) => typeof identity[key] === "string" && (identity[key] as string).length > 0)
    && keys.every((key) => identity[key] === undefined || typeof identity[key] === "string");
};

const isAtomicDomCommand = (command: Record<string, unknown>): boolean =>
  typeof command.selector === "string" && command.selector.length > 0
  && isDomElementIdentity(command.identity);

const hasSafeTabId = (command: Record<string, unknown>): boolean => Number.isSafeInteger(command.tabId);

const tabCommand = (
  validate: (command: Record<string, unknown>) => boolean = () => true,
): ((command: Record<string, unknown>) => boolean) =>
  (command) => hasSafeTabId(command) && validate(command);

const BROWSER_WIRE_COMMAND_VALIDATORS: Readonly<Record<string, (command: Record<string, unknown>) => boolean>> = {
  acquire_target: isAcquireTargetCommand,
  inspect_target: tabCommand(),
  navigate_target: tabCommand(isNavigateOrEvaluateCommand),
  evaluate_target: tabCommand(isNavigateOrEvaluateCommand),
  click_target: tabCommand(isClickTargetCommand),
  click_dom_target: tabCommand((command) => isAtomicDomCommand(command)
    && (command.expectedText === undefined || typeof command.expectedText === "string")),
  fill_dom_target: tabCommand((command) => isAtomicDomCommand(command)
    && typeof command.approvedText === "string" && command.approvedText.length > 0
    && typeof command.clearBeforeType === "boolean"),
  move_target: tabCommand((command) => isFiniteNumber(command.x) && isFiniteNumber(command.y)),
  scroll_target: tabCommand((command) =>
    isFiniteNumber(command.x) && isFiniteNumber(command.y)
    && isFiniteNumber(command.deltaX) && isFiniteNumber(command.deltaY)),
  text_target: tabCommand(isTextTargetCommand),
  screenshot_target: tabCommand(),
  set_file_input_files: tabCommand((command) =>
    typeof command.selector === "string" && typeof command.filePath === "string"),
  focus_target: tabCommand((command) => Number.isSafeInteger(command.windowId)),
  release_target: tabCommand(),
  close_target: tabCommand(),
};

const isBrowserWireCommand = (value: unknown): value is BrowserWireCommand => {
  if (!value || typeof value !== "object") return false;
  const command = value as Record<string, unknown>;
  if (typeof command.kind !== "string") return false;
  return BROWSER_WIRE_COMMAND_VALIDATORS[command.kind]?.(command) ?? false;
};

const isCommandMessage = (record: Record<string, unknown>): boolean =>
  typeof record.commandId === "string" && record.commandId.length > 0
  && Number.isSafeInteger(record.sequence) && (record.sequence as number) > 0
  && isFiniteNumber(record.deadlineAt)
  && (record.mutationClass === "observation"
    || record.mutationClass === "idempotent_mutation"
    || record.mutationClass === "non_idempotent_mutation")
  && (record.expectedLoaderId === undefined || typeof record.expectedLoaderId === "string")
  && isBrowserWireCommand(record.command);

const isResponseMessage = (record: Record<string, unknown>): boolean =>
  typeof record.commandId === "string" && record.commandId.length > 0
  && Number.isSafeInteger(record.sequence) && (record.sequence as number) > 0
  && typeof record.ok === "boolean"
  && (record.errorCode === undefined || typeof record.errorCode === "string")
  && (record.errorMessage === undefined || typeof record.errorMessage === "string");

export const isBrowserWireMessage = (value: unknown): value is BrowserWireMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.protocolVersion !== GRASSEYE_BROWSER_PROTOCOL_VERSION) return false;
  if (record.type === "extension_hello") return true;
  if (record.type === "controller_challenge" || record.type === "extension_authenticated") {
    return typeof record.nonce === "string" && record.nonce.length >= 32;
  }
  if (record.type === "command") return isCommandMessage(record);
  if (record.type === "response") return isResponseMessage(record);
  return false;
};
