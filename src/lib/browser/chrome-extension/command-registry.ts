import { assertExtensionCommandPermit, type ExtensionCommandPermit } from "./command-permit-validator.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { isBrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";

export type ExtensionCommandKind = BrowserGovernedCommand["kind"];

export type RegisteredExtensionCommand = Readonly<{
  kind: ExtensionCommandKind;
  mutationClass: "observation" | "mutation" | "lifecycle";
}>;

export class ExtensionCommandRegistry {
  private readonly commands = new Map<ExtensionCommandKind, RegisteredExtensionCommand>([
    ["dom-intent", { kind: "dom-intent", mutationClass: "observation" }],
    ["observe", { kind: "observe", mutationClass: "observation" }],
    ["screenshot", { kind: "screenshot", mutationClass: "observation" }],
    ["file-input", { kind: "file-input", mutationClass: "mutation" }],
    ["authenticated-media", { kind: "authenticated-media", mutationClass: "observation" }],
    ["wait", { kind: "wait", mutationClass: "observation" }],
    ["park-target", { kind: "park-target", mutationClass: "lifecycle" }],
  ]);

  public resolveCommand(kind: string): RegisteredExtensionCommand {
    const command = this.commands.get(kind as ExtensionCommandKind);
    if (!command) throw new Error("BROWSER_CAPABILITY_REJECTED");
    return command;
  }
}

const registry = new ExtensionCommandRegistry();

const fixedCapabilityByKind: Partial<Record<ExtensionCommandKind, ExtensionCommandPermit["capabilityId"]>> = {
  observe: "browser.dom.inspect.v1",
  screenshot: "browser.screenshot.v1",
  "file-input": "browser.file-input.v1",
  "authenticated-media": "browser.authenticated-media.v1",
  wait: "browser.wait.v1",
  "park-target": "browser.park-target.v1",
};

type DomIntentKind = Extract<BrowserGovernedCommand, { kind: "dom-intent" }>["intent"]["kind"];
const domCapabilityByIntent: Record<DomIntentKind, ExtensionCommandPermit["capabilityId"]> = {
  document: "browser.dom.inspect.v1",
  observe: "browser.dom.inspect.v1",
  readExactAssistantTurn: "browser.dom.inspect.v1",
  inspect: "browser.dom.inspect.v1",
  find: "browser.dom.find.v1",
  readText: "browser.dom.read-text.v1",
  readAttribute: "browser.dom.read-attribute.v1",
  selectExactGptConversation: "browser.dom.click.v1",
  acknowledgeKnownGptRateLimit: "browser.dom.click.v1",
  readKnownGptRateLimitClearance: "browser.dom.inspect.v1",
  click: "browser.dom.click.v1",
  hover: "browser.dom.hover.v1",
  doubleClick: "browser.dom.double-click.v1",
  keypress: "browser.dom.keypress.v1",
  fill: "browser.dom.fill.v1",
};

export const resolveCommand = (kind: string): RegisteredExtensionCommand => registry.resolveCommand(kind);

export const admitExtensionCommand = async (input: Readonly<{ command: BrowserGovernedCommand; permit: ExtensionCommandPermit }>): Promise<RegisteredExtensionCommand> => {
  if (!isBrowserCapabilityId(input.permit.capabilityId)) throw new Error("BROWSER_CAPABILITY_REJECTED");
  const command = resolveCommand(input.command.kind);
  const expectedMutationClass = input.command.kind === "dom-intent"
    && input.command.intent.kind === "selectExactGptConversation" ? "lifecycle"
    : input.command.kind === "dom-intent" && (input.command.intent.kind === "click"
    || input.command.intent.kind === "acknowledgeKnownGptRateLimit"
    || input.command.intent.kind === "hover" || input.command.intent.kind === "doubleClick"
    || input.command.intent.kind === "keypress" || input.command.intent.kind === "fill")
    ? "mutation"
    : command.mutationClass;
  if (expectedMutationClass !== input.permit.mutationClass) throw new Error("BROWSER_CAPABILITY_REJECTED");
  if (!matchesCapability(input.command, input.permit.capabilityId)) throw new Error("BROWSER_CAPABILITY_REJECTED");
  await assertExtensionCommandPermit(input.permit);
  return Object.freeze({ ...command, mutationClass: expectedMutationClass });
};

const matchesCapability = (command: BrowserGovernedCommand, capabilityId: ExtensionCommandPermit["capabilityId"]): boolean => {
  const expected = command.kind === "dom-intent"
    ? domCapabilityByIntent[command.intent.kind]
    : fixedCapabilityByKind[command.kind];
  return expected === capabilityId;
};
