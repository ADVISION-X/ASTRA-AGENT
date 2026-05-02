import {
  getLocalAiRoleControls,
  setLocalAiRoleStartupState,
} from "./runtime/role-controls.js";

export const getAiWorkbenchRoleControls = () => getLocalAiRoleControls();

export const setAiWorkbenchRoleStartupState = (input: {
  role: Parameters<typeof setLocalAiRoleStartupState>[0]["role"];
  enabled: boolean;
}) => setLocalAiRoleStartupState(input);