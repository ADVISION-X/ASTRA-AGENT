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

function safeAttributeValue(name, value, syntheticMarker, uiAllowlist) {
  if (value === null) return undefined;
  if (["role", "type", "data-testid", "data-message-author-role", "contenteditable", "accept", "multiple",
    "disabled", "aria-checked", "aria-expanded", "aria-selected", "aria-disabled", "aria-valuemin",
    "aria-valuemax", "aria-valuenow", "aria-hidden", "aria-busy", "hidden", "inert", "data-state"].includes(name)) return value;
  if (name === "id" && /^(?:prompt-textarea|composer-plus-btn|upload-files)$/u.test(value)) return value;
  if (name === "aria-label" && (uiAllowlist.has(value) || value.includes(syntheticMarker))) return value;
  return { kind: "HASH_ONLY", sha256: hash(value), length: value.length };
}

export async function createChromeSceneCollector({
  browser,
  tab,
  outputPath,
  syntheticMarker,
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
  if (!outputPath || !syntheticMarker || !runId || !captureEpoch
    || !recaptureTrigger || !qaTabIdentityHash) {
    throw new Error("CHROME_SCENE_COLLECTOR_CONFIGURATION_REQUIRED");
  }
  if (!["PAGE_EVIDENCE_CONFLICT_CONFIRMED", "HUMAN_REQUESTED_RECAPTURE"].includes(recaptureTrigger.kind)) {
    throw new Error("RECAPTURE_FORBIDDEN");
  }

  const scenes = await readExisting(outputPath);
  let activeTab = tab;
  let syntheticAttachmentUploadArmed = false;
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

  async function collect(sceneId, { includeMedia = false, decisionReceipt = null, transitionReceipt = null } = {}) {
    if (!sceneId || scenes.some((scene) => scene.sceneId === sceneId)) {
      throw new Error(`SCENE_ID_DUPLICATE_OR_EMPTY:${sceneId ?? ""}`);
    }
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
            machineFacts: {
              userRoleDescendants: element.querySelectorAll("[data-message-author-role='user']").length,
              assistantRoleDescendants: element.querySelectorAll("[data-message-author-role='assistant']").length,
              imageDescendants: element.querySelectorAll("img").length,
              ownerTurnTestId: ownerTurn ? ownerTurn.getAttribute("data-testid") : null,
              inertAncestor: element.closest("[inert]") !== null,
              ariaHiddenAncestor: element.closest("[aria-hidden='true']") !== null,
              syntheticAttachmentGroupAncestor: (element.closest("[role='group'][aria-label]")
                ?.getAttribute("aria-label") || "").includes(marker),
              attachmentUploadSpinner: element.matches("svg[class*='animate-spin']"),
              attachmentPendingAction: element.matches("button.cursor-wait"),
              attachmentUploadErrorAlert: attachmentUploadArmed
                && element.getAttribute("role") === "alert" && subtreeText.length > 0,
              activeAttachmentPopoverAncestor: element.closest("div.popover[aria-busy='false']") !== null,
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
      return {
        nodes: result,
        currentUrl: ownerDocument?.location?.href ?? "",
        documentTimeOrigin: ownerDocument?.defaultView?.performance?.timeOrigin
          ?? ownerDocument?.lastModified,
      };
    }, { marker: syntheticMarker, attachmentUploadArmed: syntheticAttachmentUploadArmed });
    const rawNodes = rawPacket.nodes;

    const syntheticAttachmentNodes = rawNodes.filter((node) =>
      node.attributes.role === "group"
      && String(node.attributes["aria-label"] ?? "").includes(syntheticMarker));
    const pageFacts = {
      assistantGenerationActive: rawNodes.some((node) => node.attributes["data-testid"] === "stop-button"
        || String(node.attributes["aria-label"] ?? "").includes("停止")),
      assistantTerminalErrorVisible: rawNodes.some((node) =>
        (node.attributes.role === "alert" || /error/u.test(String(node.attributes["data-testid"] ?? "")))
        && Boolean(node.machineFacts.ownerTurnTestId)),
      semanticMediaReady: rawNodes.some((node) => node.tag === "img" && node.media?.complete === true
        && node.media.naturalWidth > 100 && node.media.alt.length > 0),
      attachmentSyntheticCount: syntheticAttachmentNodes.length,
      attachmentUploadPending: rawNodes.some((node) => node.machineFacts.syntheticAttachmentGroupAncestor
        && (node.machineFacts.attachmentUploadSpinner || node.machineFacts.attachmentPendingAction
          || node.attributes.role === "progressbar" || node.attributes["aria-busy"] === "true"
          || ["loading", "uploading", "pending"].includes(node.attributes["data-state"]))),
      attachmentTerminalErrorVisible: rawNodes.some((node) =>
        (node.machineFacts.syntheticAttachmentGroupAncestor
          && (node.attributes.role === "alert" || /error/u.test(String(node.attributes["data-testid"] ?? ""))))
        || node.machineFacts.attachmentUploadErrorAlert),
      syntheticMarkerNodeCount: rawNodes.filter((node) => (node.directText || "").includes(syntheticMarker)).length,
      syntheticUserTurnCount: rawNodes.filter((node) => node.attributes["data-message-author-role"] === "user"
        && (node.subtreeText || "").includes(syntheticMarker)).length,
      syntheticAssistantTurnCount: rawNodes.filter((node) => node.attributes["data-message-author-role"] === "assistant").length,
      composerCount: rawNodes.filter((node) => node.attributes.id === "prompt-textarea").length,
      composerSyntheticMarkerPresent: rawNodes.some((node) => node.attributes.id === "prompt-textarea"
        && (node.subtreeText || "").includes(syntheticMarker)),
      currentRouteKind: new URL(rawPacket.currentUrl).pathname.startsWith("/c/") ? "CONVERSATION" : "ROOT",
    };

    const nodes = rawNodes.map((node) => {
      const text = node.directText || "";
      const keepText = uiAllowlist.has(text) || text.includes(syntheticMarker);
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
        label: safeAttributeValue("aria-label", sibling.label, syntheticMarker, uiAllowlist),
      }));
      return {
        ...node,
        attributes: Object.fromEntries(Object.entries(node.attributes).map(([name, value]) => [
          name, safeAttributeValue(name, value, syntheticMarker, uiAllowlist),
        ])),
        directText: undefined,
        subtreeText: undefined,
        siblings,
        media,
        textProjection: keepText
          ? { kind: "ALLOWLISTED", value: text }
          : { kind: "HASH_ONLY", sha256: hash(text), length: text.length },
        subtreeTextProjection: uiAllowlist.has(node.subtreeText || "")
          ? { kind: "ALLOWLISTED", value: node.subtreeText || "" }
          : { kind: "HASH_ONLY", sha256: hash(node.subtreeText || ""), length: (node.subtreeText || "").length },
      };
    });
    const url = sanitizeUrl(rawPacket.currentUrl);
    const activeTabIdentityHash = tabIdentityHash(activeTab);
    const documentIdentityHash = hash(`${activeTabIdentityHash}:${rawPacket.documentTimeOrigin}`);
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
      decisionReceipt,
      transitionReceipt,
    };
    const scene = { ...base, stateSignature: sceneContentSignature(base) };
    scenes.push(scene);
    await writeAtomic(outputPath, scenes);
    if (pageFacts.attachmentTerminalErrorVisible
      || (pageFacts.attachmentSyntheticCount > 0 && !pageFacts.attachmentUploadPending)) {
      syntheticAttachmentUploadArmed = false;
    }
    return scene;
  }

  async function collectHiddenTarget(sceneId, locator, { decisionReceipt = null } = {}) {
    if (!sceneId || scenes.some((scene) => scene.sceneId === sceneId)) {
      throw new Error(`SCENE_ID_DUPLICATE_OR_EMPTY:${sceneId ?? ""}`);
    }
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
      const keepText = uiAllowlist.has(text) || text.includes(syntheticMarker);
      return {
        ...node,
        attributes: Object.fromEntries(Object.entries(node.attributes).map(([name, value]) => [
          name, safeAttributeValue(name, value, syntheticMarker, uiAllowlist),
        ])),
        directText: undefined,
        subtreeText: undefined,
        textProjection: keepText
          ? { kind: "ALLOWLISTED", value: text }
          : { kind: "HASH_ONLY", sha256: hash(text), length: text.length },
        subtreeTextProjection: uiAllowlist.has(node.subtreeText || "")
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
    const documentIdentityHash = hash(`${activeTabIdentityHash}:${rawPacket.documentTimeOrigin}`);
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
      decisionReceipt,
      transitionReceipt: null,
    };
    const scene = { ...base, stateSignature: sceneContentSignature(base) };
    scenes.push(scene);
    await writeAtomic(outputPath, scenes);
    return scene;
  }

  async function performAndCollect({
    actionId,
    operation,
    locator,
    preSceneId,
    postSceneId,
    value,
    includeMedia = false,
    postcondition = null,
  }) {
    if (!actionId || !operation || !locator || !preSceneId || !postSceneId) {
      throw new Error("SCENE_ACTION_CONFIGURATION_REQUIRED");
    }
    const pre = await collect(preSceneId, {
      includeMedia,
      decisionReceipt: { kind: "ACTION_REQUIRED", actionId, operation },
    });
    if (operation === "setInputFiles" && (Array.isArray(value) ? value : [value])
      .some((entry) => String(entry ?? "").split(/[\\/]/u).at(-1)?.includes(syntheticMarker))) {
      syntheticAttachmentUploadArmed = true;
    }
    const issuedAt = new Date().toISOString();
    const syntheticUserCountBefore = postcondition === "synthetic-user-turn-hydrated"
      ? await activeTab.playwright.locator("[data-message-author-role='user']").evaluateAll(
        (elements, marker) => elements.filter((element) => (element.textContent || "").includes(marker)).length,
        syntheticMarker,
      ) : 0;
    try {
      if (operation === "click") await locator.click();
      else if (operation === "fill") await locator.fill(value ?? "");
      else if (operation === "press") await locator.press(value ?? "");
      else if (operation === "setInputFiles") {
        const chooserPromise = activeTab.playwright.waitForEvent("filechooser", { timeoutMs: 10000 });
        await locator.click();
        const chooser = await chooserPromise;
        if (Array.isArray(value) && value.length > 1 && !chooser.isMultiple()) {
          throw new Error("SCENE_FILE_CHOOSER_NOT_MULTIPLE");
        }
        await chooser.setFiles(value, { timeoutMs: 10000 });
      }
      else if (operation === "goto") await activeTab.goto(value);
      else if (operation === "clickAndAdoptSuccessor") {
        if (!browser?.tabs?.list || !browser?.tabs?.get) throw new Error("SCENE_BROWSER_REQUIRED");
        const sourceTab = activeTab;
        const sourceTabIdentityHash = tabIdentityHash(sourceTab);
        const before = await browser.tabs.list();
        const beforeIds = new Set(before.map((entry) => entry.id));
        await locator.click();
        let successors = [];
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          successors = (await browser.tabs.list()).filter((entry) => !beforeIds.has(entry.id));
          if (successors.length === 1) break;
          if (successors.length > 1) throw new Error("SCENE_SUCCESSOR_AMBIGUOUS");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (successors.length !== 1) throw new Error("SCENE_SUCCESSOR_MISSING");
        activeTab = await browser.tabs.get(successors[0].id);
        const successorTabIdentityHash = tabIdentityHash(activeTab);
        await activeTab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 10000 });
        let successorSettled = false;
        const settleDeadline = Date.now() + 10000;
        while (Date.now() < settleDeadline) {
          const currentUrl = await activeTab.url();
          const mainCount = await activeTab.playwright.locator("main").count();
          const turnCount = await activeTab.playwright.locator("[data-testid^='conversation-turn-']").count();
          if (currentUrl.startsWith("https://chatgpt.com/c/") && mainCount === 1 && turnCount > 0) {
            successorSettled = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!successorSettled) throw new Error("SCENE_SUCCESSOR_NOT_SETTLED");
        await sourceTab.close();
        value = { sourceTabIdentityHash, successorTabIdentityHash };
      }
      else throw new Error(`SCENE_ACTION_UNSUPPORTED:${operation}`);
      if (postcondition === "synthetic-user-turn-hydrated") {
        let satisfied = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          const currentUrl = await activeTab.url();
          const syntheticUserCount = await activeTab.playwright.locator("[data-message-author-role='user']").evaluateAll(
            (elements, marker) => elements.filter((element) => (element.textContent || "").includes(marker)).length,
            syntheticMarker,
          );
          if (currentUrl.startsWith("https://chatgpt.com/c/") && syntheticUserCount > syntheticUserCountBefore) {
            satisfied = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!satisfied) throw new Error("SCENE_POSTCONDITION_SYNTHETIC_USER_TURN_NOT_HYDRATED");
      } else if (postcondition === "root-empty-chat-hydrated") {
        let satisfied = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          const currentUrl = await activeTab.url();
          const composerCount = await activeTab.playwright.locator("#prompt-textarea").count();
          const syntheticUserCount = await activeTab.playwright.locator("[data-message-author-role='user']").evaluateAll(
            (elements, marker) => elements.filter((element) => (element.textContent || "").includes(marker)).length,
            syntheticMarker,
          );
          if (currentUrl === "https://chatgpt.com/" && composerCount === 1 && syntheticUserCount === 0) {
            satisfied = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!satisfied) throw new Error("SCENE_POSTCONDITION_ROOT_EMPTY_CHAT_NOT_HYDRATED");
      } else if (postcondition === "synthetic-conversation-hydrated") {
        let satisfied = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          const currentUrl = await activeTab.url();
          const mainCount = await activeTab.playwright.locator("main").count();
          const syntheticUserCount = await activeTab.playwright.locator("[data-message-author-role='user']").evaluateAll(
            (elements, marker) => elements.filter((element) => (element.textContent || "").includes(marker)).length,
            syntheticMarker,
          );
          if (currentUrl.startsWith("https://chatgpt.com/c/") && mainCount === 1 && syntheticUserCount > 0) {
            satisfied = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!satisfied) throw new Error("SCENE_POSTCONDITION_SYNTHETIC_CONVERSATION_NOT_HYDRATED");
      } else if (postcondition !== null) {
        throw new Error(`SCENE_POSTCONDITION_UNSUPPORTED:${postcondition}`);
      }
    } catch (error) {
      const terminal = {
        actionId,
        operation,
        issuedAt,
        completedAt: new Date().toISOString(),
        outcome: "THREW",
        preSceneId: pre.sceneId,
        preSceneSignature: pre.stateSignature,
        errorHash: hash(error instanceof Error ? error.message : String(error)),
      };
      await collect(postSceneId, { includeMedia, transitionReceipt: terminal });
      throw error;
    }
    const terminal = {
      actionId,
      operation,
      issuedAt,
      completedAt: new Date().toISOString(),
      outcome: "DISPATCH_RETURNED",
      preSceneId: pre.sceneId,
      preSceneSignature: pre.stateSignature,
      ...(operation === "clickAndAdoptSuccessor" ? { tabTransition: value } : {}),
    };
    return collect(postSceneId, { includeMedia, transitionReceipt: terminal });
  }

  return { collect, collectHiddenTarget, performAndCollect, scenes, currentTab: () => activeTab };
}
