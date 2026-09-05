import type { ConversationState } from "./observation.js";

const checkpointActionsMenuReady = (state: ConversationState): boolean =>
  state.checkpointMenuRaw === 1 && state.checkpointMenuEligible === 1
  && state.openForkRaw === 1 && state.openForkEligible === 1
  && state.triggerExpanded === "true";
export const forkDestinationMenuReady = (state: ConversationState): boolean =>
  checkpointActionsMenuReady(state)
  && state.destinationMenuRaw === 1 && state.destinationMenuEligible === 1
  && state.forkToNewChatRaw === 1 && state.forkToNewChatEligible === 1;
