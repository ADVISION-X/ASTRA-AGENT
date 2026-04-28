export type MouseClickSafetyPolicy = {
  requireGeometryGuard: true;
  allowOperatorManual: boolean;
  operatorManualApprovalRef: string | null;
  allowRightClick: boolean;
  allowDoubleClick: boolean;
  maxDurationMs: number;
  blockIfOutOfBounds: boolean;
  blockIfNoSourceRef: boolean;
};

export const DEFAULT_MOUSE_CLICK_SAFETY_POLICY: MouseClickSafetyPolicy = {
  requireGeometryGuard: true,
  allowOperatorManual: false,
  operatorManualApprovalRef: null,
  allowRightClick: false,
  allowDoubleClick: false,
  maxDurationMs: 5000,
  blockIfOutOfBounds: true,
  blockIfNoSourceRef: true,
};