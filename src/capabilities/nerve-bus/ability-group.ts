import { NERVE_BUS_CHILD_IDS } from "./schema.js";
import type {
  NerveBusAbilityGroup,
  CreateNerveBusAbilityGroupInput,
} from "./contract.js";
import { dispatchAbilityCommand } from "./runtime/dispatch-ability-command.js";
import { requestAi } from "./runtime/request-ai.js";
import { dispatchHumanCommand } from "./runtime/dispatch-human-command.js";

export function createNerveBusAbilityGroup(
  input: CreateNerveBusAbilityGroupInput,
): NerveBusAbilityGroup {
  void NERVE_BUS_CHILD_IDS;
  return {
    dispatchAbilityCommand: (cmd) => dispatchAbilityCommand(input.handlerPort, cmd),
    requestAi: (cmd) => requestAi(input.handlerPort, cmd),
    dispatchHumanCommand: (cmd) => dispatchHumanCommand(input.handlerPort, cmd),
  };
}
