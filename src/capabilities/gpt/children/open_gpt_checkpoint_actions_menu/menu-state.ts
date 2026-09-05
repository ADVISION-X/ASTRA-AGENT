import type { ConversationState } from "./observation.js";

export const checkpointActionsMenuReady = (state: ConversationState): boolean =>
  state.checkpointMenuRaw === 1 && state.checkpointMenuEligible === 1
  && state.openForkRaw === 1 && state.openForkEligible === 1
  && state.triggerExpanded === "true";

export const checkpointActionsMenuAbsent = (state: ConversationState): boolean =>
  state.checkpointMenuRaw === 0 && state.openForkRaw === 0
  && state.destinationMenuRaw === 0 && state.forkToNewChatRaw === 0
  && state.triggerExpanded !== "true";

export const checkpointActionsReadbackReady = (state: ConversationState): boolean =>
  state.triggerRaw === 1 && state.triggerEligible === 1
  && state.triggerExpanded === "true" && checkpointActionsMenuReady(state);
