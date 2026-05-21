import type { DomSnapshot } from "../../../types/dom-automation.js";
import type { ReadDomSnapshotInput } from "../../../types/dom-automation-inputs.js";

export type DomSnapshotContract = DomSnapshot;

export type ReadDomSnapshotContractInput = ReadDomSnapshotInput;

export type DomSnapshotEvidenceContract = Pick<
  DomSnapshot,
  | "url"
  | "title"
  | "forms"
  | "inputs"
  | "buttons"
  | "links"
  | "fileInputs"
  | "dialogs"
  | "frames"
  | "textBlocks"
  | "tableRows"
  | "roleRows"
  | "genericClickableElements"
  | "detectedStates"
  | "capturedAt"
>;
