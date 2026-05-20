import type {
  DomSnapshot,
  ReadDomSnapshotInput,
} from "../schema.js";

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
