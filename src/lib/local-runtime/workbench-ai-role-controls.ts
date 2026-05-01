import {
  getLocalAiRoleControls,
  setLocalAiRoleStartupState,
} from "../../capabilities/ai/index.js";
import type { WorkbenchLocalModelRole } from "./workbench-local-ai-role-types.js";

export const getWorkbenchLocalAiRoleControls = () => getLocalAiRoleControls();

export const setWorkbenchLocalAiRoleStartupState = (input: {
  role: WorkbenchLocalModelRole;
  enabled: boolean;
}) => setLocalAiRoleStartupState(input);