import type { ConversationState } from "./observation.js";

const ownerRelationMatches = (
  triggerId: string | null,
  triggerMenuId: string | null,
  menuId: string | null,
  menuLabelledBy: string | null,
): boolean => {
  const labelledByPresent = menuLabelledBy !== null && menuLabelledBy.length > 0;
  const controlsPresent = triggerMenuId !== null && triggerMenuId.length > 0;
  if (!labelledByPresent && !controlsPresent) return false;
  return (!labelledByPresent || menuLabelledBy === triggerId)
    && (!controlsPresent || triggerMenuId === menuId);
};

const checkpointActionsMenuReady = (state: ConversationState): boolean =>
  state.checkpointMenuRaw === 1 && state.checkpointMenuEligible === 1
  && state.openForkRaw === 1 && state.openForkEligible === 1
  && state.triggerExpanded === "true"
  && state.triggerId !== null && state.triggerId.length > 0
  && ownerRelationMatches(
    state.triggerId, state.triggerMenuId, state.checkpointMenuId, state.checkpointMenuLabelledBy,
  );
export const forkDestinationMenuReady = (state: ConversationState): boolean =>
  checkpointActionsMenuReady(state)
  && state.destinationMenuRaw === 1 && state.destinationMenuEligible === 1
  && state.forkToNewChatRaw === 1 && state.forkToNewChatEligible === 1
  && state.openForkExpanded === "true"
  && ownerRelationMatches(
    state.openForkId, state.openForkMenuId, state.destinationMenuId, state.destinationMenuLabelledBy,
  );

export const forkDestinationMenuAbsent = (state: ConversationState): boolean =>
  checkpointActionsMenuReady(state)
  && state.destinationMenuRaw === 0 && state.forkToNewChatRaw === 0
  && state.openForkExpanded !== "true";
