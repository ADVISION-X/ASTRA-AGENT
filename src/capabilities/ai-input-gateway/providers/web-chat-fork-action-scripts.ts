export const CHECKPOINT_OBSERVATION_SCRIPT = `
const normalize = (node) => (node instanceof HTMLElement ? node.innerText : node?.textContent || "")
  .replace(/\\s+/gu, " ")
  .trim();
const turns = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"))
  .map((turn, index) => {
    const user = turn.querySelector("[data-message-author-role='user']");
    const assistant = turn.querySelector("[data-message-author-role='assistant']");
    const role = user ? "user" : assistant ? "assistant" : null;
    const node = user || assistant;
    return role && node ? {
      turnId: turn.getAttribute("data-testid") || "turn-" + String(index + 1),
      role,
      text: normalize(node),
    } : null;
  })
  .filter(Boolean);
return {pageUrl: location.href, turns};
`;

export const OPEN_BRANCH_ACTION_SCRIPT = (assistantTurnId: string): string => `
const turnId = ${JSON.stringify(assistantTurnId)};
const visible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const label = (element) => [
  element.getAttribute("aria-label"),
  element.getAttribute("title"),
  element.textContent,
].filter(Boolean).join(" ").replace(/\\s+/gu, " ").trim();
const turn = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"))
  .find((node) => node.getAttribute("data-testid") === turnId);
if (!(turn instanceof HTMLElement)) {
  return {status: "review_required", message: "CHATGPT_FORK_CHECKPOINT_TURN_MISSING", labels: []};
}
turn.scrollIntoView({block: "center"});
const direct = Array.from(turn.querySelectorAll("button,[role='button'],[role='menuitem']"))
  .filter(visible)
  .filter((element) => /branch in new chat|在新聊天中分支|新聊天中的分支|分支到新聊天/iu.test(label(element)));
if (direct.length === 1) {
  direct[0].click();
  return {status: "success", message: "clicked direct branch action", labels: direct.map(label)};
}
if (direct.length > 1) {
  return {status: "review_required", message: "CHATGPT_FORK_ACTION_AMBIGUOUS", labels: direct.map(label)};
}
const menus = Array.from(turn.querySelectorAll("button,[role='button']"))
  .filter(visible)
  .filter((element) => /more|更多|其他操作|actions/iu.test(label(element)));
if (menus.length !== 1) {
  return {
    status: "review_required",
    message: menus.length === 0 ? "CHATGPT_FORK_MENU_CONTROL_MISSING" : "CHATGPT_FORK_MENU_CONTROL_AMBIGUOUS",
    labels: menus.map(label),
  };
}
menus[0].click();
return {status: "menu_opened", message: "opened exact checkpoint action menu", labels: menus.map(label)};
`;

export const CLICK_OPEN_BRANCH_MENU_SCRIPT = `
const visible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const label = (element) => [
  element.getAttribute("aria-label"),
  element.getAttribute("title"),
  element.textContent,
].filter(Boolean).join(" ").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("[role='menuitem'],[data-radix-menu-content] button,[role='menu'] button"))
  .filter(visible)
  .filter((element) => /branch in new chat|在新聊天中分支|新聊天中的分支|分支到新聊天/iu.test(label(element)));
if (candidates.length !== 1) {
  return {
    status: "review_required",
    message: candidates.length === 0 ? "CHATGPT_FORK_MENU_ITEM_MISSING" : "CHATGPT_FORK_MENU_ITEM_AMBIGUOUS",
    labels: candidates.map(label),
  };
}
candidates[0].click();
return {status: "success", message: "clicked exact branch menu item", labels: candidates.map(label)};
`;

