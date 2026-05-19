import { DomSnapshotSchema } from "../schema.js";
import type { DomSnapshot } from "../schema.js";

export function createDomSnapshotFixture(): DomSnapshot {
  return DomSnapshotSchema.parse({
    url: "https://example.test/orders",
    title: "DOM Fixture",
    forms: [
      {
        selectorCandidate: "form#orders",
        id: "orders",
        name: "orders",
        labelText: "Order Search",
        inputCount: 1,
        buttonCount: 1,
      },
    ],
    inputs: [
      {
        tagName: "input",
        type: "search",
        role: "searchbox",
        ariaLabel: "Order search",
        labelText: "Order search",
        placeholder: "Search orders",
        name: "order-search",
        id: "order-search",
        visibleText: "",
        nearbyText: "Search orders by id",
        disabled: false,
        hidden: false,
        selectorCandidate: "#order-search",
      },
    ],
    buttons: [
      {
        tagName: "button",
        role: "button",
        ariaLabel: "Search",
        visibleText: "Search",
        nearbyText: "Search orders by id",
        disabled: false,
        hidden: false,
        selectorCandidate: "#search-button",
      },
    ],
    links: [],
    fileInputs: [
      {
        tagName: "input",
        type: "file",
        ariaLabel: "Upload invoice",
        visibleText: "",
        nearbyText: "Upload invoice",
        disabled: false,
        hidden: false,
        selectorCandidate: "#upload-file",
      },
    ],
    dialogs: [],
    frames: [],
    textBlocks: [
      {
        tagName: "div",
        ariaLabel: "Upload invoice",
        visibleText: "Upload invoice",
        nearbyText: "Upload invoice",
        disabled: false,
        hidden: false,
        selectorCandidate: "#upload-entry",
        candidateKind: "text-block",
      },
    ],
    tableRows: [
      {
        tagName: "tr",
        visibleText: "123-ORDER Ready",
        nearbyText: "Buyer Ready",
        disabled: false,
        hidden: false,
        selectorCandidate: "#order-row",
        candidateKind: "table-row",
      },
    ],
    roleRows: [],
    genericClickableElements: [
      {
        tagName: "div",
        role: "button",
        ariaLabel: "Upload invoice",
        visibleText: "Upload invoice",
        nearbyText: "Upload invoice",
        disabled: false,
        hidden: false,
        selectorCandidate: "#upload-entry",
        candidateKind: "clickable",
      },
    ],
    detectedStates: ["upload_entry_visible"],
    capturedAt: new Date("2026-05-19T00:00:00.000Z").toISOString(),
  });
}