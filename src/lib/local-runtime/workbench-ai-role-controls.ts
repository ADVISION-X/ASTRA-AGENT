import {
  getAiWorkbenchRoleControls,
  setAiWorkbenchRoleStartupState,
} from "../../capabilities/ai/public-contracts/workbench-role-controls/contract.js";
import type { WorkbenchLocalModelRole } from "./workbench-local-ai-role-types.js";

export const getWorkbenchLocalAiRoleControls = () => getAiWorkbenchRoleControls();

export const setWorkbenchLocalAiRoleStartupState = (input: {
  role: WorkbenchLocalModelRole;
  enabled: boolean;
}) => setAiWorkbenchRoleStartupState(input);