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

export const checkpointActionsMenuReady = (state: ConversationState): boolean =>
  state.checkpointMenuRaw === 1 && state.checkpointMenuEligible === 1
  && state.openForkRaw === 1 && state.openForkEligible === 1
  && state.triggerExpanded === "true"
  && state.triggerId !== null && state.triggerId.length > 0
  && ownerRelationMatches(
    state.triggerId, state.triggerMenuId, state.checkpointMenuId, state.checkpointMenuLabelledBy,
  );

export const checkpointActionsMenuAbsent = (state: ConversationState): boolean =>
  state.checkpointMenuRaw === 0 && state.openForkRaw === 0
  && state.destinationMenuRaw === 0 && state.forkToNewChatRaw === 0
  && state.triggerExpanded !== "true";

export const checkpointActionsReadbackReady = (state: ConversationState): boolean =>
  state.triggerRaw === 1 && state.triggerEligible === 1
  && state.triggerExpanded === "true" && checkpointActionsMenuReady(state);
