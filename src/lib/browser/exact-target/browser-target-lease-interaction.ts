import { randomUUID } from "node:crypto";

import type {
  BrowserActionResult,
  BrowserGeometrySnapshot,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type { BrowserWireCommand } from "../protocol/generated/browser-protocol.js";
import type { BrowserMutationClass } from "./browser-command-contract.js";
import { readBrowserTargetGeometry } from "./browser-target-lease-observation.js";
import type { BrowserTargetLeaseObservationPort } from "./browser-target-lease-observation.js";

export type BrowserTargetLeaseInteractionPort = Readonly<{
  rawTabId(): number;
  command<T>(
    command: BrowserWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
  ): Promise<{ commandId: string; result: T }>;
  action(id: string, message: string, started: number): BrowserActionResult;
  defaultAbortSignal(): AbortSignal | undefined;
  observationPort(): BrowserTargetLeaseObservationPort;
}>;

export const clickBrowserTarget = async (
  port: BrowserTargetLeaseInteractionPort,
  input: Parameters<BrowserTargetLease["click"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  await port.command(
    {
      kind: "click_target",
      tabId: port.rawTabId(),
      x: input.point.x,
      y: input.point.y,
      button: input.button ?? "left",
      clickCount: input.clickCount ?? 1,
    },
    "non_idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  return port.action(
    `browser-click:${randomUUID()}`,
    `clicked ${input.targetLabel}`,
    started,
  );
};

export const moveBrowserTarget = async (
  port: BrowserTargetLeaseInteractionPort,
  input: Parameters<BrowserTargetLease["move"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  await port.command(
    {
      kind: "move_target",
      tabId: port.rawTabId(),
      x: input.point.x,
      y: input.point.y,
    },
    "idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  return port.action(
    `browser-move:${randomUUID()}`,
    `moved within ${input.targetLabel}`,
    started,
  );
};

export const scrollBrowserTarget = async (
  port: BrowserTargetLeaseInteractionPort,
  input: Parameters<BrowserTargetLease["scroll"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  const geometry = await readBrowserTargetGeometry(
    port.observationPort(),
    input.abortSignal,
  );
  await port.command(
    scrollCommand(port.rawTabId(), input, geometry),
    "idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  return port.action(
    `browser-scroll:${randomUUID()}`,
    `scrolled ${input.targetLabel}`,
    started,
  );
};

export const clickLocatedBrowserDomElement = async (
  port: BrowserTargetLeaseInteractionPort,
  input: Parameters<BrowserTargetLease["clickLocatedDomElement"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  await port.command(
    {
      kind: "click_dom_target",
      tabId: port.rawTabId(),
      selector: input.element.selector,
      identity: input.element.identity,
      ...(input.expectedText ? { expectedText: input.expectedText } : {}),
    },
    "non_idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  return port.action(
    `browser-dom-click:${randomUUID()}`,
    `clicked ${input.targetLabel}`,
    started,
  );
};

export const fillLocatedBrowserDomElement = async (
  port: BrowserTargetLeaseInteractionPort,
  input: Parameters<BrowserTargetLease["fillLocatedDomElement"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  await port.command(
    {
      kind: "fill_dom_target",
      tabId: port.rawTabId(),
      selector: input.element.selector,
      identity: input.element.identity,
      approvedText: input.approvedText,
      clearBeforeType: input.clearBeforeType,
    },
    "non_idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  return port.action(
    `browser-dom-fill:${randomUUID()}`,
    `filled ${input.targetLabel}`,
    started,
  );
};

export const textInputBrowserTarget = async (
  port: BrowserTargetLeaseInteractionPort,
  input: Parameters<BrowserTargetLease["textInput"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  await port.command(
    {
      kind: "text_target",
      tabId: port.rawTabId(),
      action: input.action,
      ...(input.text != null ? { text: input.text } : {}),
      ...(input.key != null ? { key: input.key } : {}),
    },
    "non_idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  return port.action(
    `browser-text:${randomUUID()}`,
    `text input ${input.targetLabel}`,
    started,
  );
};

const scrollCommand = (
  tabId: number,
  input: Parameters<BrowserTargetLease["scroll"]>[0],
  geometry: BrowserGeometrySnapshot,
): BrowserWireCommand => ({
  kind: "scroll_target",
  tabId,
  x: input.anchorPoint?.x ?? geometry.viewportWidth / 2,
  y: input.anchorPoint?.y ?? geometry.viewportHeight / 2,
  deltaX: input.deltaX,
  deltaY: input.deltaY,
});
