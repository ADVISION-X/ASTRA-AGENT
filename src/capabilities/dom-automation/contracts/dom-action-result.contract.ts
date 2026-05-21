import type { DomActionResult } from "../../../types/dom-automation.js";
import type { ClickDomElementInput, FillDomElementInput, UploadApprovedFileInput } from "../../../types/dom-automation-inputs.js";

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
