import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";

const DEFAULT_ROOT_SELECTOR =
  'main, body [role="menu"]:visible, body [role="dialog"]:visible, body [role="listbox"]:visible, body [role="alert"]:visible';

const DEFAULT_UI_ALLOWLIST = new Set([
  "GPT-5.6 Sol",
  "GPT-5.5",
  "选择模型",
  "能力",
  "高",
  "思考强度",
  "添加文件等",
  "与 ChatGPT 聊天",
  "从电脑上传",
  "分支到新聊天",
  "打开新分支",
  "停止生成",
  "重新生成",
  "复制",
  "好回答",
  "差回答",
  "更多操作",
]);

function hash(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function acceptedDecisionReceipt(receipt) {
  if (receipt === null) return null;
  if (receipt?.kind === "ALREADY_SATISFIED" && exactKeys(receipt, ["kind"])) return { kind: receipt.kind };
  if (receipt?.kind === "ACTION_REQUIRED"
    && exactKeys(receipt, ["kind", "actionId", "operation"])
    && typeof receipt.actionId === "string" && receipt.actionId.length > 0
    && typeof receipt.operation === "string" && receipt.operation.length > 0) {
    return { kind: receipt.kind, actionId: receipt.actionId, operation: receipt.operation };
  }
  throw new Error("CHROME_SCENE_DECISION_RECEIPT_INVALID");
}

function acceptedTransitionReceipt(receipt, scenes) {
  if (receipt === null) return null;
  if (!exactKeys(receipt, ["actionId", "operation", "issuedAt", "completedAt", "outcome",
    "preSceneId", "preSceneSignature", "postconditionPassed"])
    || typeof receipt.actionId !== "string" || receipt.actionId.length === 0
    || typeof receipt.operation !== "string" || receipt.operation.length === 0
    || receipt.outcome !== "DISPATCH_RETURNED" || typeof receipt.postconditionPassed !== "boolean"
    || !Number.isFinite(Date.parse(receipt.issuedAt)) || !Number.isFinite(Date.parse(receipt.completedAt))
    || Date.parse(receipt.completedAt) < Date.parse(receipt.issuedAt)
    || !/^sha256:[a-f0-9]{64}$/u.test(receipt.preSceneSignature ?? "")) {
    throw new Error("CHROME_SCENE_TRANSITION_RECEIPT_INVALID");
  }
  const pre = scenes.find((scene) => scene.sceneId === receipt.preSceneId);
  if (!pre || pre.stateSignature !== receipt.preSceneSignature
    || pre.decisionReceipt?.kind !== "ACTION_REQUIRED"
    || pre.decisionReceipt.actionId !== receipt.actionId
    || pre.decisionReceipt.operation !== receipt.operation) {
    throw new Error("CHROME_SCENE_TRANSITION_RECEIPT_UNBOUND");
  }
  return { actionId: receipt.actionId, operation: receipt.operation, issuedAt: receipt.issuedAt,
    completedAt: receipt.completedAt, outcome: receipt.outcome, preSceneId: receipt.preSceneId,
    preSceneSignature: receipt.preSceneSignature, postconditionPassed: receipt.postconditionPassed };
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    if (url.pathname.startsWith("/c/")) {
      return `${url.origin}/c/${hash(url.pathname.slice(3))}`;
    }
    return `${url.origin}${url.pathname === "/" ? "/" : `/${hash(url.pathname)}`}`;
  } catch {
    return "URL_UNAVAILABLE";
  }
}

async function readExisting(outputPath) {
  try {
    const parsed = JSON.parse(await readFile(outputPath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("SCENE_STORE_NOT_ARRAY");
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw new Error(`SCENE_STORE_CORRUPT:${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeAtomic(outputPath, value) {
  const temporary = `${outputPath}.tmp-${randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, outputPath);
}

function sceneContentSignature(scene) {
  return hash(JSON.stringify({
    url: scene.url,
    activeTabIdentityHash: scene.activeTabIdentityHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash,
    nodeCount: scene.nodeCount,
    nodes: scene.nodes,
    pageFacts: scene.pageFacts,
    binding: scene.binding,
    decisionReceipt: scene.decisionReceipt,
    transitionReceipt: scene.transitionReceipt,
  }));
}

function safeAttributeValue(name, value, _productMarker, uiAllowlist, allowPlainUiValue = false) {
  if (value === null) return undefined;
  if (["role", "type", "data-testid", "data-message-author-role", "contenteditable", "accept", "multiple",
    "disabled", "aria-checked", "aria-expanded", "aria-selected", "aria-disabled", "aria-valuemin",
    "aria-valuemax", "aria-valuenow", "aria-hidden", "aria-busy", "hidden", "inert", "data-state"].includes(name)) return value;
  if (name === "id" && /^(?:prompt-textarea|composer-plus-btn|upload-files)$/u.test(value)) return value;
  if (name === "aria-label" && allowPlainUiValue && uiAllowlist.has(value)) return value;
  return { kind: "HASH_ONLY", sha256: hash(value), length: value.length };
}

function uiTextAllowed(node, value, uiAllowlist) {
  if (!uiAllowlist.has(value)) return false;
  const attributes = node?.attributes ?? {};
  return node?.tag === "button"
    || ["button", "menuitem", "menuitemradio", "option", "slider", "tab"].includes(attributes.role);
}

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function sanitizeDomTree(node, productMarker, uiAllowlist, allowPlainUiText = false) {
  if (!node || typeof node !== "object") return null;
  if (node.kind === "TRUNCATED") return { kind: "TRUNCATED" };
  if (node.kind === "TEXT") {
    const value = String(node.value ?? "").replace(/\s+/gu, " ").trim();
    return allowPlainUiText && uiAllowlist.has(value)
      ? { kind: "ALLOWLISTED_TEXT", value }
      : { kind: "HASH_ONLY_TEXT", sha256: hash(value), length: value.length };
  }
  return {
    kind: "ELEMENT",
    tag: node.tag,
    attributes: Object.fromEntries(Object.entries(node.attributes ?? {}).map(([name, value]) =>
      [name, safeAttributeValue(name, value, productMarker, uiAllowlist, allowPlainUiText)])),
    children: (node.children ?? []).map((child) => sanitizeDomTree(
      child, productMarker, uiAllowlist, allowPlainUiText,
    )),
  };
}

function renderSanitizedDom(node) {
  if (!node || node.kind === "TRUNCATED") return "<!-- subtree-truncated -->";
  if (node.kind === "ALLOWLISTED_TEXT") return escapeHtml(node.value);
  if (node.kind === "HASH_ONLY_TEXT") return `<!-- text ${node.sha256} length=${node.length} -->`;
  const attributes = Object.entries(node.attributes ?? {}).flatMap(([name, value]) => {
    if (value === undefined) return [];
    if (value && typeof value === "object" && value.kind === "HASH_ONLY") {
      return [`data-redacted-${name}-sha256="${escapeHtml(value.sha256)}"`,
        `data-redacted-${name}-length="${value.length}"`];
    }
    return [`${name}="${escapeHtml(value)}"`];
  }).join(" ");
  const open = attributes ? `<${node.tag} ${attributes}>` : `<${node.tag}>`;
  return `${open}${(node.children ?? []).map(renderSanitizedDom).join("")}</${node.tag}>`;
}

export async function createChromeSceneCollector({
  tab,
  outputPath,
  productMarker,
  runId,
  captureEpoch,
  recaptureTrigger,
  qaTabIdentityHash,
  rootSelector = DEFAULT_ROOT_SELECTOR,
  uiAllowlist = DEFAULT_UI_ALLOWLIST,
}) {
  if (!tab?.playwright || typeof tab.url !== "function") {
    throw new Error("CHROME_SCENE_COLLECTOR_TAB_REQUIRED");
  }
  if (!outputPath || !productMarker || !runId || !captureEpoch
    || !recaptureTrigger || !qaTabIdentityHash) {
    throw new Error("CHROME_SCENE_COLLECTOR_CONFIGURATION_REQUIRED");
  }
  if (!["PAGE_EVIDENCE_CONFLICT_CONFIRMED", "HUMAN_REQUESTED_RECAPTURE"].includes(recaptureTrigger.kind)) {
    throw new Error("RECAPTURE_FORBIDDEN");
  }

  const scenes = await readExisting(outputPath);
  const activeTab = tab;
  const tabIdentityHash = (targetTab) => {
    const id = targetTab?.id ?? targetTab?.tabId;
    if ((typeof id !== "string" && typeof id !== "number") || String(id).length === 0) {
      throw new Error("CHROME_SCENE_TAB_IDENTITY_UNAVAILABLE");
    }
    return hash(id);
  };
  if (tabIdentityHash(activeTab) !== qaTabIdentityHash) {
    throw new Error("CHROME_SCENE_QA_TAB_IDENTITY_MISMATCH");
  }

  const binding = Object.freeze({
    runId,
    captureEpoch,
    qaTabIdentityHash,
  });

  async function collect(sceneId, { includeMedia = false, decisionReceipt = null,
    transitionReceipt = null, attachmentUploadExpected = false } = {}) {
    if (!sceneId || scenes.some((scene) => scene.sceneId === sceneId)) {
      throw new Error(`SCENE_ID_DUPLICATE_OR_EMPTY:${sceneId ?? ""}`);
    }
    const normalizedDecisionReceipt = acceptedDecisionReceipt(decisionReceipt);
    const normalizedTransitionReceipt = acceptedTransitionReceipt(transitionReceipt, scenes);
    const roots = activeTab.playwright.locator(rootSelector);
    const rawPacket = await roots.evaluateAll((elements, context) => {
      const { marker, attachmentUploadArmed } = context;
      const attributeNames = [
        "id",
        "role",
        "type",
        "aria-label",
        "aria-checked",
        "aria-expanded",
        "aria-selected",
        "aria-disabled",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
        "aria-busy",
        "data-state",
        "data-testid",
        "data-message-author-role",
        "contenteditable",
        "accept",
        "multiple",
        "disabled",
        "class",
      ];
      const seen = new Set();
      const result = [];
      const editableBlockText = (node) => {
        const name = String(node.nodeName || "").toUpperCase();
        if (node.nodeType === 3 || name === "#TEXT") return typeof node.nodeValue === "string" ? node.nodeValue : "";
        if (name === "BR") return "";
        return Array.from(node.childNodes || []).map((child) =>
          String(child.nodeName || "").toUpperCase() === "BR" ? "\n" : editableBlockText(child)).join("").replace(/\n$/u, "");
      };
      const exactEditableText = (element) => {
        if (!(element instanceof Element) || element.getAttribute("contenteditable") !== "true") return null;
        const children = Array.from(element.childNodes || []);
        if (children.length === 0) return element.textContent || "";
        return children.map((child) => editableBlockText(child)).join("\n");
      };
      const blockNames = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
        "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
        "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"]);
      const inlineCode = (value) => {
        const runs = Array.from(value.matchAll(/`+/g), (match) => match[0].length);
        const fence = "`".repeat(Math.max(0, ...runs) + 1);
        return `${fence}${value}${fence}`;
      };
      const semanticNode = (node, parent, insidePre) => {
        const name = String(node.nodeName || "").toUpperCase();
        if (node.nodeType === 3 || name === "#TEXT") return typeof node.nodeValue === "string" ? node.nodeValue : "";
        if (["#COMMENT", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH"].includes(name)
          || (node instanceof Element && (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true"))) return "";
        if (name === "BR") return "\n";
        const nestedInPre = insidePre || name === "PRE";
        const body = Array.from(node.childNodes || []).map((child) => semanticNode(child, node, nestedInPre)).join("");
        if (name === "STRONG" || name === "B") return `**${body}**`;
        if (name === "EM" || name === "I") return `*${body}*`;
        if (name === "CODE") return insidePre ? body : inlineCode(body);
        if (name === "LI") return `${parent && String(parent.nodeName).toUpperCase() === "OL" ? "1. " : "- "}${body}\n`;
        return blockNames.has(name) ? `${body}\n` : body;
      };
      const semanticText = (node) => {
        const value = Array.from(node.childNodes || []).map((child) => semanticNode(child, node, false)).join("");
        return value.endsWith("\n") ? value.slice(0, -1) : value;
      };
      const userPromptText = (turn) => {
        const userRoles = turn.querySelectorAll("[data-message-author-role='user']");
        if (userRoles.length !== 1
          || turn.querySelectorAll("[data-message-author-role='assistant']").length !== 0) return null;
        const collapsed = turn.querySelectorAll("[data-testid='collapsible-user-message-content']");
        if (collapsed.length === 1) return semanticText(collapsed[0]);
        if (collapsed.length !== 0) return null;
        const shortPromptLeaves = userRoles[0].querySelectorAll(".whitespace-pre-wrap");
        return shortPromptLeaves.length === 1 ? semanticText(shortPromptLeaves[0]) : null;
      };
      const semanticMediaNodes = (turn) => [...turn.querySelectorAll("img[alt]")].filter((node) => {
        if (node.tagName !== "IMG" || !node.isConnected || !node.complete
          || node.alt.trim().length === 0 || node.naturalWidth <= 0 || node.naturalHeight <= 0) return false;
        const bounds = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return bounds.width > 0 && bounds.height > 0 && style.display !== "none"
          && style.visibility !== "hidden" && style.visibility !== "collapse"
          && Number.parseFloat(style.opacity || "1") > 0;
      });
      const domSnapshot = (root) => {
        let count = 0;
        const visit = (node, depth) => {
          count += 1;
          if (count > 200 || depth > 6) return { kind: "TRUNCATED" };
          if (node.nodeType === 3) return { kind: "TEXT", value: node.textContent || "" };
          if (node.nodeType !== 1) return null;
          const attributes = {};
          for (const name of attributeNames) {
            const value = node.getAttribute(name);
            if (value !== null) attributes[name] = value;
          }
          return { kind: "ELEMENT", tag: node.tagName.toLowerCase(), attributes,
            children: [...node.childNodes].map((child) => visit(child, depth + 1)).filter(Boolean) };
        };
        return visit(root, 0);
      };

      for (const root of elements) {
        for (const element of [root, ...root.querySelectorAll("*")]) {
          if (
            !element ||
            element.nodeType !== 1 ||
            seen.has(element) ||
            element.closest("nav,aside")
          ) {
            continue;
          }
          seen.add(element);
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0 ||
            rect.width === 0 ||
            rect.height === 0
          ) {
            continue;
          }

          const attributes = {};
          for (const name of attributeNames) {
            const value = element.getAttribute(name);
            if (value !== null) attributes[name] = value;
          }
          const directText = [...element.childNodes]
            .filter((node) => node.nodeType === 3)
            .map((node) => node.textContent || "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          const subtreeText = (element.textContent || "").replace(/\s+/g, " ").trim();
          const parent = element.parentElement;
          const ownerTurn = element.closest("[data-testid^='conversation-turn-']");

          result.push({
            tag: element.tagName.toLowerCase(),
            attributes,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            style: {
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
            },
            directText,
            subtreeText,
            domTree: domSnapshot(element),
            machineFacts: {
              userRoleDescendants: element.querySelectorAll("[data-message-author-role='user']").length,
              assistantRoleDescendants: element.querySelectorAll("[data-message-author-role='assistant']").length,
              imageDescendants: element.querySelectorAll("img").length,
              ownerTurnTestId: ownerTurn ? ownerTurn.getAttribute("data-testid") : null,
              inertAncestor: element.closest("[inert]") !== null,
              ariaHiddenAncestor: element.closest("[aria-hidden='true']") !== null,
              productionAttachmentGroupAncestor: element.closest("[role='group'][aria-label]") !== null,
              productTurnMarkerObserved: directText.includes(marker) || subtreeText.includes(marker),
              attachmentUploadSpinner: element.matches("svg[class*='animate-spin']"),
              attachmentPendingAction: element.matches("button.cursor-wait"),
              attachmentUploadErrorAlert: attachmentUploadArmed
                && element.getAttribute("role") === "alert" && subtreeText.length > 0,
              activeAttachmentPopoverAncestor: element.closest("div.popover[aria-busy='false']") !== null,
              composerFormAncestor: element.closest("form:has(#prompt-textarea)") !== null,
            },
            media:
              element.tagName === "IMG"
                ? {
                    source: element.currentSrc || element.getAttribute("src") || "",
                    alt: element.getAttribute("alt") || "",
                    naturalWidth: element.naturalWidth,
                    naturalHeight: element.naturalHeight,
                    complete: element.complete,
                  }
                : null,
            ancestors: parent
              ? [
                  {
                    tag: parent.tagName.toLowerCase(),
                    role: parent.getAttribute("role"),
                    testId: parent.getAttribute("data-testid"),
                  },
                ]
              : [],
            siblings: parent
              ? [...parent.children].slice(0, 12).map((sibling) => ({
                  tag: sibling.tagName.toLowerCase(),
                  role: sibling.getAttribute("role"),
                  testId: sibling.getAttribute("data-testid"),
                  label: sibling.getAttribute("aria-label"),
                }))
              : [],
          });
        }
      }
      const ownerDocument = elements[0]?.ownerDocument;
      const composer = ownerDocument?.querySelectorAll("#prompt-textarea[contenteditable='true']") ?? [];
      const userPromptTexts = Array.from(ownerDocument?.querySelectorAll("[data-testid^='conversation-turn-']") ?? [])
        .flatMap((turn) => {
          const promptText = userPromptText(turn);
          return promptText === null ? [] : [promptText];
        });
      const conversationTurns = Array.from(ownerDocument?.querySelectorAll("[data-testid^='conversation-turn-']") ?? []);
      const assistantSemanticTexts = Array.from(ownerDocument?.querySelectorAll("[data-message-author-role='assistant']") ?? [])
        .map((node) => semanticText(node));
      const attachmentLabels = Array.from(ownerDocument?.querySelectorAll("form:has(#prompt-textarea) [role='group'][aria-label]") ?? [])
        .map((node) => (node.getAttribute("aria-label") || "").normalize("NFC"));
      const modelTexts = Array.from(ownerDocument?.querySelectorAll("[data-testid='composer-model-picker-slider-advanced-view'][data-active='true']:not([inert]) [role='menuitemradio']") ?? [])
        .map((node) => (node.textContent || "").trim());
      const reasoningScaleFacts = Array.from(ownerDocument?.querySelectorAll("[data-model-reasoning-effort-slider] [role='slider']") ?? [])
        .map((node) => ({ minimum: node.getAttribute("aria-valuemin"), maximum: node.getAttribute("aria-valuemax"),
          current: node.getAttribute("aria-valuenow") }));
      const assistantTurnIds = Array.from(ownerDocument?.querySelectorAll("[data-testid^='conversation-turn-']") ?? [])
        .filter((turn) => turn.querySelectorAll("[data-message-author-role='user']").length === 0
          && (turn.querySelectorAll("[data-message-author-role='assistant']").length === 1
            || semanticMediaNodes(turn).length === 1))
        .map((turn) => turn.getAttribute("data-testid") || "");
      const userTurnBindings = conversationTurns.flatMap((turn) => {
        const promptText = userPromptText(turn);
        if (promptText === null) return [];
        return [{ userTurnId: turn.getAttribute("data-testid") || null, promptText,
          turnMarkers: promptText.match(/\[GRASSEYE:[a-f0-9]{24}\]/gu) ?? [] }];
      });
      const turnBindings = conversationTurns.flatMap((turn, index) => {
        const assistants = turn.querySelectorAll("[data-message-author-role='assistant']");
        const semanticMedia = semanticMediaNodes(turn);
        if (turn.querySelectorAll("[data-message-author-role='user']").length !== 0
          || (assistants.length !== 1 && semanticMedia.length !== 1)) return [];
        let userTurn = null;
        for (let prior = index - 1; prior >= 0; prior -= 1) {
          const candidate = conversationTurns[prior];
          if (candidate.querySelectorAll("[data-message-author-role='user']").length === 1
            && candidate.querySelectorAll("[data-message-author-role='assistant']").length === 0) {
            userTurn = candidate;
            break;
          }
        }
        const promptText = userTurn ? userPromptText(userTurn) : null;
        return [{ assistantTurnId: turn.getAttribute("data-testid") || null, promptText,
          responseText: assistants.length === 1 ? semanticText(assistants[0]) : "",
          turnMarkers: promptText?.match(/\[GRASSEYE:[a-f0-9]{24}\]/gu) ?? [] }];
      });
      return {
        nodes: result,
        currentUrl: ownerDocument?.location?.href ?? "",
        documentTimeOrigin: ownerDocument?.defaultView?.performance?.timeOrigin
          ?? ownerDocument?.lastModified,
        pageInputFacts: {
          exactComposerText: composer.length === 1 ? exactEditableText(composer[0]) : null,
          userPromptTexts,
          assistantSemanticTexts,
          attachmentLabels,
          modelTexts,
          reasoningScaleFacts,
          assistantTurnIds,
          userTurnBindings,
          turnBindings,
        },
      };
    }, { marker: productMarker, attachmentUploadArmed: attachmentUploadExpected });
    const rawNodes = rawPacket.nodes;

    const productionAttachmentNodes = rawNodes.filter((node) =>
      node.attributes.role === "group" && node.machineFacts.productionAttachmentGroupAncestor === true);
    const pageFacts = {
      assistantGenerationActive: rawNodes.some((node) => node.attributes["data-testid"] === "stop-button"
        || String(node.attributes["aria-label"] ?? "").includes("停止")),
      assistantTerminalErrorVisible: rawNodes.some((node) =>
        (node.attributes.role === "alert" || /error/u.test(String(node.attributes["data-testid"] ?? "")))
        && Boolean(node.machineFacts.ownerTurnTestId)),
      semanticMediaReady: rawNodes.some((node) => node.tag === "img" && node.media?.complete === true
        && node.media.naturalWidth > 100 && node.media.alt.length > 0),
      approvedAttachmentCount: productionAttachmentNodes.length,
      attachmentUploadPending: rawNodes.some((node) => node.machineFacts.productionAttachmentGroupAncestor
        && (node.machineFacts.attachmentUploadSpinner || node.machineFacts.attachmentPendingAction
          || node.attributes.role === "progressbar" || node.attributes["aria-busy"] === "true"
          || ["loading", "uploading", "pending"].includes(node.attributes["data-state"]))),
      attachmentTerminalErrorVisible: rawNodes.some((node) =>
        (node.machineFacts.productionAttachmentGroupAncestor
          && (node.attributes.role === "alert" || /error/u.test(String(node.attributes["data-testid"] ?? ""))))
        || node.machineFacts.attachmentUploadErrorAlert),
      productMarkerNodeCount: rawNodes.filter((node) => (node.directText || "").includes(productMarker)).length,
      productUserTurnCount: rawNodes.filter((node) => node.attributes["data-message-author-role"] === "user"
        && (node.subtreeText || "").includes(productMarker)).length,
      assistantTurnCount: rawNodes.filter((node) => node.attributes["data-message-author-role"] === "assistant").length,
      composerCount: rawNodes.filter((node) => node.attributes.id === "prompt-textarea").length,
      composerProductMarkerPresent: rawNodes.some((node) => node.attributes.id === "prompt-textarea"
        && (node.subtreeText || "").includes(productMarker)),
      currentRouteKind: new URL(rawPacket.currentUrl).pathname.startsWith("/c/") ? "CONVERSATION" : "ROOT",
      currentConversationUrlHash: hash((() => {
        const current = new URL(rawPacket.currentUrl); return `${current.origin}${current.pathname}`;
      })()),
      exactComposerHash: rawPacket.pageInputFacts.exactComposerText === null
        ? null : hash(rawPacket.pageInputFacts.exactComposerText),
      exactUserPromptHashes: rawPacket.pageInputFacts.userPromptTexts.map(hash),
      assistantSemanticTextHashes: rawPacket.pageInputFacts.assistantSemanticTexts.map(hash),
      attachmentLabelHashes: rawPacket.pageInputFacts.attachmentLabels.map(hash).sort(),
      visibleModelTextHashes: rawPacket.pageInputFacts.modelTexts.map(hash).sort(),
      reasoningScaleFacts: rawPacket.pageInputFacts.reasoningScaleFacts,
      turnMarkerHashes: [...new Set(rawPacket.pageInputFacts.userPromptTexts
        .flatMap((value) => value.match(/\[GRASSEYE:[a-f0-9]{24}\]/gu) ?? []).map(hash))].sort(),
      assistantTurnIdHashes: rawPacket.pageInputFacts.assistantTurnIds.map(hash).sort(),
      userTurnBindings: rawPacket.pageInputFacts.userTurnBindings.map((entry) => ({
        userTurnIdHash: entry.userTurnId === null ? null : hash(entry.userTurnId),
        promptHash: hash(entry.promptText),
        turnMarkerHashes: [...new Set(entry.turnMarkers.map(hash))].sort(),
      })),
      conversationTurnBindings: rawPacket.pageInputFacts.turnBindings.map((entry) => ({
        assistantTurnIdHash: entry.assistantTurnId === null ? null : hash(entry.assistantTurnId),
        precedingPromptHash: entry.promptText === null ? null : hash(entry.promptText),
        responseHash: hash(entry.responseText),
        turnMarkerHashes: [...new Set(entry.turnMarkers.map(hash))].sort(),
      })),
    };

    const nodes = rawNodes.map((node) => {
      const text = node.directText || "";
      const keepText = uiTextAllowed(node, text, uiAllowlist);
      const media =
        includeMedia && node.media
          ? {
              sourceHash: hash(node.media.source),
              altHash: hash(node.media.alt),
              altLength: node.media.alt.length,
              naturalWidth: node.media.naturalWidth,
              naturalHeight: node.media.naturalHeight,
              complete: node.media.complete,
            }
          : null;
      const siblings = (node.siblings ?? []).map((sibling) => ({
        ...sibling,
        label: safeAttributeValue("aria-label", sibling.label, productMarker, uiAllowlist,
          uiTextAllowed({ tag: sibling.tag, attributes: { role: sibling.role, "aria-label": sibling.label } },
            sibling.label, uiAllowlist)),
      }));
      const sanitizedDomTree = sanitizeDomTree(node.domTree, productMarker, uiAllowlist, keepText);
      return {
        ...node,
        domTree: undefined,
        sanitizedDomTree,
        sanitizedOuterHtml: renderSanitizedDom(sanitizedDomTree),
        attributes: Object.fromEntries(Object.entries(node.attributes).map(([name, value]) => [
          name, safeAttributeValue(name, value, productMarker, uiAllowlist,
            name === "aria-label" ? uiTextAllowed(node, value, uiAllowlist) : keepText),
        ])),
        directText: undefined,
        subtreeText: undefined,
        siblings,
        media,
        textProjection: keepText
          ? { kind: "ALLOWLISTED", value: text }
          : { kind: "HASH_ONLY", sha256: hash(text), length: text.length },
        subtreeTextProjection: uiTextAllowed(node, node.subtreeText || "", uiAllowlist)
          ? { kind: "ALLOWLISTED", value: node.subtreeText || "" }
          : { kind: "HASH_ONLY", sha256: hash(node.subtreeText || ""), length: (node.subtreeText || "").length },
      };
    });
    const url = sanitizeUrl(rawPacket.currentUrl);
    const activeTabIdentityHash = tabIdentityHash(activeTab);
    const documentIdentityHash = hash(`${activeTabIdentityHash}:${url}`);
    const observationRevisionHash = hash(JSON.stringify({ documentIdentityHash, url, nodes, pageFacts }));
    const base = {
      sceneId,
      capturedAt: new Date().toISOString(),
      url,
      activeTabIdentityHash,
      documentIdentityHash,
      observationRevisionHash,
      nodeCount: nodes.length,
      nodes,
      pageFacts,
      binding,
      decisionReceipt: normalizedDecisionReceipt,
      transitionReceipt: normalizedTransitionReceipt,
    };
    const scene = { ...base, stateSignature: sceneContentSignature(base) };
    scenes.push(scene);
    await writeAtomic(outputPath, scenes);
    return scene;
  }

  async function collectHiddenTarget(sceneId, locator, { decisionReceipt = null } = {}) {
    if (!sceneId || scenes.some((scene) => scene.sceneId === sceneId)) {
      throw new Error(`SCENE_ID_DUPLICATE_OR_EMPTY:${sceneId ?? ""}`);
    }
    const normalizedDecisionReceipt = acceptedDecisionReceipt(decisionReceipt);
    if (!locator || typeof locator.evaluateAll !== "function") {
      throw new Error("CHROME_SCENE_COLLECTOR_LOCATOR_REQUIRED");
    }
    const rawPacket = await locator.evaluateAll((elements) => ({
      currentUrl: elements[0]?.ownerDocument?.location?.href ?? "",
      documentTimeOrigin: elements[0]?.ownerDocument?.defaultView?.performance?.timeOrigin
        ?? elements[0]?.ownerDocument?.lastModified,
      nodes: elements.map((element) => {
        const attributeNames = [
          "id",
          "role",
          "type",
          "aria-label",
          "data-testid",
          "accept",
          "multiple",
          "disabled",
          "class",
        ];
        const attributes = {};
        for (const name of attributeNames) {
          const value = element.getAttribute(name);
          if (value !== null) attributes[name] = value;
        }
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement;
        return {
          tag: element.tagName.toLowerCase(),
          attributes,
          domTree: { kind: "ELEMENT", tag: element.tagName.toLowerCase(), attributes,
            children: [...element.childNodes].filter((child) => child.nodeType === 3)
              .map((child) => ({ kind: "TEXT", value: child.textContent || "" })) },
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          style: {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
          },
          connected: element.isConnected,
          directText: (element.textContent || "").replace(/\s+/g, " ").trim(),
          subtreeText: (element.textContent || "").replace(/\s+/g, " ").trim(),
          ancestors: parent
            ? [{ tag: parent.tagName.toLowerCase(), role: parent.getAttribute("role") }]
            : [],
          siblings: parent
            ? [...parent.children].slice(0, 12).map((sibling) => ({
                tag: sibling.tagName.toLowerCase(),
                role: sibling.getAttribute("role"),
                testId: sibling.getAttribute("data-testid"),
              }))
            : [],
        };
      }),
    }));
    const rawNodes = rawPacket.nodes;
    const nodes = rawNodes.map((node) => {
      const text = node.directText || "";
      const keepText = uiTextAllowed(node, text, uiAllowlist);
      const sanitizedDomTree = sanitizeDomTree(node.domTree, productMarker, uiAllowlist, keepText);
      return {
        ...node,
        domTree: undefined,
        sanitizedDomTree,
        sanitizedOuterHtml: renderSanitizedDom(sanitizedDomTree),
        attributes: Object.fromEntries(Object.entries(node.attributes).map(([name, value]) => [
          name, safeAttributeValue(name, value, productMarker, uiAllowlist, keepText),
        ])),
        directText: undefined,
        subtreeText: undefined,
        textProjection: keepText
          ? { kind: "ALLOWLISTED", value: text }
          : { kind: "HASH_ONLY", sha256: hash(text), length: text.length },
        subtreeTextProjection: uiTextAllowed(node, node.subtreeText || "", uiAllowlist)
          ? { kind: "ALLOWLISTED", value: node.subtreeText || "" }
          : { kind: "HASH_ONLY", sha256: hash(node.subtreeText || ""), length: (node.subtreeText || "").length },
      };
    });
    const pageFacts = {
      hiddenTargetCount: nodes.length,
      currentRouteKind: new URL(rawPacket.currentUrl).pathname.startsWith("/c/") ? "CONVERSATION" : "ROOT",
    };
    const url = sanitizeUrl(rawPacket.currentUrl);
    const activeTabIdentityHash = tabIdentityHash(activeTab);
    const documentIdentityHash = hash(`${activeTabIdentityHash}:${url}`);
    const observationRevisionHash = hash(JSON.stringify({ documentIdentityHash, url, nodes, pageFacts }));
    const base = {
      sceneId,
      capturedAt: new Date().toISOString(),
      url,
      activeTabIdentityHash,
      documentIdentityHash,
      observationRevisionHash,
      nodeCount: nodes.length,
      nodes,
      pageFacts,
      binding,
      decisionReceipt: normalizedDecisionReceipt,
      transitionReceipt: null,
    };
    const scene = { ...base, stateSignature: sceneContentSignature(base) };
    scenes.push(scene);
    await writeAtomic(outputPath, scenes);
    return scene;
  }

  return { collect, collectHiddenTarget, scenes };
}
