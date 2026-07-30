const CHATGPT_CONVERSATION_HREF_PATTERN_SOURCE =
  "^/c/(?!WEB:)[^/?#]+(?:[?#].*)?$";
export const CHATGPT_CONVERSATION_ROW_SELECTOR = "li";

export const buildConversationOptionsTargetScript = (input: {
  canonicalConversationUrl: string;
}): string => `
const expectedPath = ${JSON.stringify(new URL(input.canonicalConversationUrl).pathname)};
const conversationHrefPattern = new RegExp(${JSON.stringify(CHATGPT_CONVERSATION_HREF_PATTERN_SOURCE)}, "u");
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      const rawHref = link.getAttribute("href") || "";
      return conversationHrefPattern.test(rawHref)
        && new URL(link.href, location.href).pathname === expectedPath
        && visible(link);
    } catch {
      return false;
    }
  });
if (links.length !== 1) {
  return {
    status: links.length === 0 ? "pending" : "review_required",
    message: links.length === 0 ? "waiting for submitted conversation sidebar entry" : "CHATGPT_CONVERSATION_LINK_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const link = links[0];
const row = link.closest(${JSON.stringify(CHATGPT_CONVERSATION_ROW_SELECTOR)})
  || (
    Array.from(link.parentElement?.children || []).includes(link)
      ? link.parentElement
      : null
  );
const options = row
  ? Array.from(row.querySelectorAll("button"))
      .filter((button) => visible(button))
      .filter((button) => /对话选项|conversation options|chat options/i.test(normalized(
        button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent
      )))
  : [];
if (options.length > 1) {
  return {
    status: "review_required",
    message: "CHATGPT_CONVERSATION_OPTIONS_AMBIGUOUS_IN_TARGET_ROW",
    pageUrl: location.href,
    observedTitle: normalized(link.textContent),
  };
}
if (options.length === 0) {
  return {
    status: "pending",
    message: "waiting for completed conversation row options control",
    pageUrl: location.href,
    observedTitle: normalized(link.textContent),
  };
}
const rect = options[0].getBoundingClientRect();
return {
  status: "success",
  message: "completed conversation row options control located",
  pageUrl: location.href,
  observedTitle: normalized(link.textContent),
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

export const buildConversationLinkTargetScript = (input: {
  canonicalConversationUrl: string;
}): string => `
const expectedPath = ${JSON.stringify(new URL(input.canonicalConversationUrl).pathname)};
const conversationHrefPattern = new RegExp(${JSON.stringify(CHATGPT_CONVERSATION_HREF_PATTERN_SOURCE)}, "u");
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      const rawHref = link.getAttribute("href") || "";
      return conversationHrefPattern.test(rawHref)
        && new URL(link.href, location.href).pathname === expectedPath
        && visible(link);
    } catch {
      return false;
    }
  });
if (links.length !== 1) {
  return {
    status: links.length === 0 ? "pending" : "review_required",
    message: links.length === 0 ? "waiting for submitted conversation sidebar link" : "CHATGPT_CONVERSATION_LINK_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = links[0].getBoundingClientRect();
return {
  status: "success",
  message: "submitted conversation sidebar link located",
  pageUrl: location.href,
  observedTitle: normalized(links[0].textContent),
  targetPoint: {x: rect.left + Math.min(rect.width / 2, 96), y: rect.top + rect.height / 2},
};
`;

const RENAME_MENU_TARGET_BODY = `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      const rawHref = link.getAttribute("href") || "";
      return conversationHrefPattern.test(rawHref)
        && new URL(link.href, location.href).pathname === expectedPath
        && visible(link);
    } catch {
      return false;
    }
  });
if (links.length !== 1) {
  return {
    status: links.length === 0 ? "pending" : "review_required",
    message: links.length === 0
      ? "waiting for exact conversation row before rename menu recovery"
      : "CHATGPT_RENAME_MENU_CONVERSATION_LINK_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const row = links[0].closest(conversationRowSelector)
  || links[0].parentElement;
const openTriggers = row
  ? Array.from(row.querySelectorAll("button"))
      .filter((button) => visible(button))
      .filter((button) =>
        button.getAttribute("aria-expanded") === "true"
        && button.getAttribute("data-state") === "open"
        && button.getAttribute("aria-haspopup") === "menu"
      )
  : [];
if (openTriggers.length !== 1) {
  return {
    status: openTriggers.length === 0 ? "pending" : "review_required",
    message: openTriggers.length === 0
      ? "waiting for exact conversation rename menu"
      : "CHATGPT_RENAME_MENU_TRIGGER_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const triggerId = openTriggers[0].getAttribute("id");
const controlledMenuId = openTriggers[0].getAttribute("aria-controls");
const menus = Array.from(document.querySelectorAll("[role='menu']"))
  .filter((menu) => visible(menu))
  .filter((menu) =>
    (triggerId && menu.getAttribute("aria-labelledby") === triggerId)
    || (controlledMenuId && menu.getAttribute("id") === controlledMenuId)
  );
if (menus.length !== 1) {
  return {
    status: menus.length === 0 ? "pending" : "review_required",
    message: menus.length === 0
      ? "waiting for exact conversation menu content"
      : "CHATGPT_RENAME_MENU_CONTENT_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const candidates = Array.from(
  menus[0].querySelectorAll("[role='menuitem'], button")
)
  .filter((node) => visible(node))
  .filter((node) => /^(重命名|rename)$/iu.test(normalized(node.textContent || node.getAttribute("aria-label"))));
if (candidates.length !== 1) {
  return {
    status: candidates.length === 0 ? "pending" : "review_required",
    message: candidates.length === 0 ? "waiting for ChatGPT rename menu item" : "CHATGPT_RENAME_MENU_ITEM_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  message: "ChatGPT rename menu item located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

export const buildRenameMenuTargetScript = (input: {
  canonicalConversationUrl: string;
}): string => `
const expectedPath = ${JSON.stringify(new URL(input.canonicalConversationUrl).pathname)};
const conversationHrefPattern = new RegExp(${JSON.stringify(CHATGPT_CONVERSATION_HREF_PATTERN_SOURCE)}, "u");
const conversationRowSelector = ${JSON.stringify(CHATGPT_CONVERSATION_ROW_SELECTOR)};
${RENAME_MENU_TARGET_BODY}
`;

export const buildRenameTextboxTargetScript = (): string => `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("input, textarea, [role='textbox']"))
  .filter((node) => visible(node))
  .filter((node) => /聊天标题|chat title/i.test(normalized(
    node.getAttribute("aria-label") || node.getAttribute("placeholder")
  )));
if (candidates.length !== 1) {
  return {
    status: candidates.length === 0 ? "pending" : "review_required",
    message: candidates.length === 0 ? "waiting for ChatGPT chat title textbox" : "CHATGPT_CHAT_TITLE_TEXTBOX_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  message: "ChatGPT chat title textbox located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

export const buildRenameTextboxValueScript = (expectedTitle: string): string => `
const expectedTitle = ${JSON.stringify(expectedTitle)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("input, textarea, [role='textbox']"))
  .filter((node) => visible(node))
  .filter((node) => /聊天标题|chat title/i.test(normalized(
    node.getAttribute("aria-label") || node.getAttribute("placeholder")
  )));
const observedValue = candidates.length === 1
  ? String("value" in candidates[0] ? candidates[0].value : candidates[0].textContent || "")
  : null;
return {
  status: candidates.length > 1
    ? "review_required"
    : observedValue === expectedTitle
      ? "success"
      : "pending",
  observedValue,
};
`;

const buildRenameIdentityProof = (input: {
  canonicalConversationUrl: string;
  systemChatTitle: string;
  turnMarker: string;
}) => ({
  expectedPath: new URL(input.canonicalConversationUrl).pathname,
  expectedTitle: input.systemChatTitle,
  marker: input.turnMarker,
  titleLinks: 1,
  markerCount: 1,
  currentPathMatches: true,
});

export const buildRenamedIdentityVerificationScript = (input: {
  canonicalConversationUrl: string;
  systemChatTitle: string;
  turnMarker: string;
}): string => {
  const proof = buildRenameIdentityProof(input);
  return `
const expectedPath = ${JSON.stringify(proof.expectedPath)};
const expectedTitle = ${JSON.stringify(proof.expectedTitle)};
const marker = ${JSON.stringify(proof.marker)};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const titleLinks = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      return (link.getAttribute("href") || "").includes("/c/")
        && new URL(link.href, location.href).pathname === expectedPath
        && normalized(link.textContent) === expectedTitle;
    } catch {
      return false;
    }
  });
const markerCount = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => normalized(node.textContent).includes(marker))
  .length;
const currentPathMatches = location.pathname === expectedPath
  || titleLinks.some((link) => new URL(link.href, location.href).pathname === location.pathname);
const documentTitleMatches = normalized(document.title) === expectedTitle;
return {
  status: titleLinks.length === ${String(proof.titleLinks)}
      && markerCount === ${String(proof.markerCount)}
      && currentPathMatches === ${JSON.stringify(proof.currentPathMatches)}
    ? "success"
    : titleLinks.length > ${String(proof.titleLinks)}
        || markerCount > ${String(proof.markerCount)}
      ? "review_required"
      : "pending",
  message: "verify manually renamed ChatGPT conversation identity",
  pageUrl: location.href,
  titleLinkCount: titleLinks.length,
  markerCount,
  currentPathMatches,
  documentTitleMatches,
};
`;
};
