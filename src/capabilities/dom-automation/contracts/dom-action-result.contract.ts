import type {
  ClickDomElementInput,
  DomActionResult,
  FillDomElementInput,
  UploadApprovedFileInput,
} from "../schema.js";

export type DomActionResultContract = DomActionResult;

export type FillDomElementContractInput = FillDomElementInput;

export type ClickDomElementContractInput = ClickDomElementInput;

export type UploadApprovedFileContractInput = UploadApprovedFileInput;

export type DomActionEvidenceContract = Pick<
  DomActionResult,
  | "ok"
  | "status"
  | "actionId"
  | "message"
  | "beforeEvidenceRef"
  | "afterEvidenceRef"
  | "reviewRequiredReason"
>;
