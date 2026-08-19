import { atomicDomExpression, runAtomicDomFillKeyboardCommand, } from "./atomic-dom-command.js";
import { configureNativeTransport, connectNativeTransport, handleNativeReconnectAlarm, } from "./service-worker-native-transport.js";
import { runInteractionCommand, runScrollPageCommand, } from "./service-worker-interaction-commands.js";
import { createServiceWorkerKeyboard } from "./service-worker-keyboard.js";
const attachedTabs = new Set();
const asRecord = (value) => value && typeof value === "object" ? value : {};
const allowedHost = (host) => host === "chatgpt.com"
    || host === "chat.openai.com"
    || host === "gemini.google.com"
    || host === "127.0.0.1"
    || host === "localhost"
    || host === "amazon.com"
    || host.endsWith(".amazon.com")
    || host === "amazon.ae"
    || host.endsWith(".amazon.ae")
    || host === "facebook.com"
    || host.endsWith(".facebook.com");
const assertAllowedUrl = (value) => {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error("TARGET_ORIGIN_MISMATCH:invalid target URL");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("TARGET_ORIGIN_MISMATCH:target scheme is not approved");
    }
    if (!allowedHost(url.hostname)) {
        throw new Error("TARGET_ORIGIN_MISMATCH:target host is not approved");
    }
    if (url.protocol === "http:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        throw new Error("TARGET_ORIGIN_MISMATCH:plain HTTP is allowed only for local test targets");
    }
    return url;
};
const requireTabIdentity = (tab) => {
    if (!Number.isInteger(tab.id) || !Number.isInteger(tab.windowId)) {
        throw new Error("TARGET_NOT_FOUND:Chrome tab identity is incomplete");
    }
    return { tabId: tab.id, windowId: tab.windowId };
};
const ensureAttached = async (tabId) => {
    if (attachedTabs.has(tabId))
        return;
    try {
        await chrome.debugger.attach({ tabId }, "1.3");
    }
    catch (error) {
        try {
            await chrome.debugger.detach({ tabId });
            await chrome.debugger.attach({ tabId }, "1.3");
        }
        catch {
            throw new Error(`DEVTOOLS_ATTACHMENT_CONFLICT:${error instanceof Error ? error.message : String(error)}`);
        }
    }
    attachedTabs.add(tabId);
    await chrome.debugger.sendCommand({ tabId }, "Page.enable");
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
    await chrome.debugger.sendCommand({ tabId }, "DOM.enable");
};
const detachTab = async (tabId) => {
    if (!attachedTabs.has(tabId))
        return;
    await chrome.debugger.detach({ tabId }).catch(() => undefined);
    attachedTabs.delete(tabId);
};
const detachAllTabs = async () => {
    await Promise.all([...attachedTabs].map((tabId) => detachTab(tabId)));
};
const evaluateInternal = async (tabId, expression, allowSideEffects) => {
    await ensureAttached(tabId);
    const response = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: allowSideEffects,
        throwOnSideEffect: !allowSideEffects,
        timeout: 10_000,
    }));
    if (response.exceptionDetails) {
        throw new Error(`TARGET_EVALUATION_FAILED:${response.result.description ?? "unknown exception"}`);
    }
    return response.result.value;
};
const observe = (tabId, expression) => evaluateInternal(tabId, expression, false);
const mutateEvaluate = (tabId, expression) => evaluateInternal(tabId, expression, true);
const readDescriptor = async (tabId) => {
    await ensureAttached(tabId);
    const tab = await chrome.tabs.get(tabId);
    const identity = requireTabIdentity(tab);
    const window = await chrome.windows.get(identity.windowId);
    const frameTree = (await chrome.debugger.sendCommand({ tabId }, "Page.getFrameTree"));
    assertAllowedUrl(frameTree.frameTree.frame.url);
    const viewport = await observe(tabId, "({innerWidth:window.innerWidth,innerHeight:window.innerHeight,deviceScaleFactor:window.devicePixelRatio||1})");
    return {
        ...identity,
        url: frameTree.frameTree.frame.url,
        title: tab.title ?? "",
        frameId: frameTree.frameTree.frame.id,
        loaderId: frameTree.frameTree.frame.loaderId,
        viewportWidth: viewport.innerWidth,
        viewportHeight: viewport.innerHeight,
        deviceScaleFactor: viewport.deviceScaleFactor,
        active: tab.active === true,
        windowFocused: window.focused === true,
    };
};
const waitForTab = async (tabId) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete")
            return tab;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("COMMAND_TIMEOUT:target page did not finish loading");
};
const sameOrigin = (left, right) => {
    try {
        return new URL(left).origin === new URL(right).origin;
    }
    catch {
        return false;
    }
};
const acquireTarget = async (command) => {
    assertAllowedUrl(command.url);
    const tabs = (await chrome.tabs.query({})).filter((tab) => typeof tab.url === "string" && (() => {
        try {
            assertAllowedUrl(tab.url);
            return true;
        }
        catch {
            return false;
        }
    })());
    const excluded = new Set(command.excludedTabIds);
    const exact = tabs.filter((tab) => tab.url === command.url &&
        Number.isInteger(tab.id) &&
        !excluded.has(tab.id));
    const sameOriginTabs = tabs.filter((tab) => sameOrigin(tab.url, command.url) &&
        Number.isInteger(tab.id) &&
        !excluded.has(tab.id));
    let chosen;
    if (command.reusePolicy === "reuse-exact-url" ||
        command.reusePolicy === "bind-existing-exact-url") {
        if (exact.length > 1)
            throw new Error("TARGET_AMBIGUOUS:multiple exact URL tabs");
        chosen = exact[0];
    }
    if (command.reusePolicy === "bind-existing-exact-origin") {
        if (sameOriginTabs.length > 1)
            throw new Error("TARGET_AMBIGUOUS:multiple exact origin tabs");
        chosen = sameOriginTabs[0];
    }
    if (!chosen && command.reusePolicy === "bind-existing-exact-url") {
        throw new Error("TARGET_NOT_FOUND:exact URL tab is not already open");
    }
    if (!chosen && command.reusePolicy === "bind-existing-exact-origin") {
        throw new Error("TARGET_NOT_FOUND:exact origin tab is not already open");
    }
    if (!chosen)
        chosen = await chrome.tabs.create({ url: command.url, active: false });
    const { tabId } = requireTabIdentity(chosen);
    await waitForTab(tabId);
    return readDescriptor(tabId);
};
const assertDocument = async (tabId, expectedLoaderId) => {
    if (!expectedLoaderId)
        return;
    const descriptor = await readDescriptor(tabId);
    if (descriptor.loaderId !== expectedLoaderId) {
        throw new Error("DOCUMENT_STALE:target document generation changed");
    }
};
const sendCommand = (tabId, method, params) => chrome.debugger.sendCommand({ tabId }, method, params);
const keyboard = createServiceWorkerKeyboard(sendCommand);
const interactionRuntime = {
    ensureAttached,
    sendCommand,
    readDescriptor,
    detachTab,
    removeTab: (tabId) => chrome.tabs.remove(tabId),
    keyCode: keyboard.keyCode,
    dispatchTypedCharacter: keyboard.dispatchTypedCharacter,
};
const runClickPageCommand = async (command) => {
    await ensureAttached(command.tabId);
    if (command.button !== "left" || command.clickCount !== 1) {
        throw new Error("BROWSER_COMMAND_FAILED:node-bound click supports one approved left click only");
    }
    const point = { x: Math.round(command.x), y: Math.round(command.y) };
    if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
        throw new Error("BROWSER_COMMAND_FAILED:click point must normalize to finite integer coordinates");
    }
    const located = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.getNodeForLocation", { ...point, includeUserAgentShadowDOM: false, ignorePointerEventsNone: false }));
    if (!Number.isInteger(located.backendNodeId)) {
        throw new Error("TARGET_NOT_FOUND:click point did not resolve to a DOM node");
    }
    const resolved = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.resolveNode", { backendNodeId: located.backendNodeId }));
    const objectId = asRecord(resolved.object).objectId;
    if (typeof objectId !== "string" || !objectId) {
        throw new Error("TARGET_NOT_FOUND:click DOM node did not resolve to a runtime object");
    }
    const validation = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: "function(x,y){const doc=this.ownerDocument||this;const hit=doc.elementFromPoint(x,y);const owner=hit?.closest(\"button,a[href],input[type='button'],input[type='submit'],input[type='text'],[role='button'],kat-button\");if(!owner)return {ok:false};const r=owner.getBoundingClientRect();const s=getComputedStyle(owner);return {ok:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!owner.disabled};}",
        arguments: [{ value: point.x }, { value: point.y }],
        awaitPromise: true,
        returnByValue: true,
    }));
    if (asRecord(validation).exceptionDetails || asRecord(asRecord(validation.result).value).ok !== true) {
        throw new Error("TARGET_NOT_FOUND:click point did not resolve to an interactive DOM owner");
    }
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1,
    });
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1,
    });
    return readDescriptor(command.tabId);
};
const runAtomicDomPageCommand = async (command) => {
    if (command.kind === "click_dom_target") {
        await mutateEvaluate(command.tabId, atomicDomExpression(command));
        return readDescriptor(command.tabId);
    }
    await runAtomicDomFillKeyboardCommand(command, crypto.randomUUID(), {
        evaluate: (expression) => mutateEvaluate(command.tabId, expression),
        pressBackspace: async () => {
            const key = keyboard.keyCode("Backspace");
            await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyDown", ...key });
            await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyUp", ...key });
        },
        typeCharacter: (character) => keyboard.dispatchTypedCharacter(command.tabId, character),
    });
    return readDescriptor(command.tabId);
};
const runPageCommand = async (command) => {
    if (command.kind === "navigate_target") {
        assertAllowedUrl(command.url);
        await ensureAttached(command.tabId);
        await chrome.debugger.sendCommand({ tabId: command.tabId }, "Page.navigate", { url: command.url });
        await waitForTab(command.tabId);
        return readDescriptor(command.tabId);
    }
    if (command.kind === "evaluate_target")
        return observe(command.tabId, command.expression);
    if (command.kind === "click_target")
        return runClickPageCommand(command);
    if (command.kind === "click_dom_target" || command.kind === "fill_dom_target") {
        return runAtomicDomPageCommand(command);
    }
    if (command.kind === "move_target") {
        await ensureAttached(command.tabId);
        await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchMouseEvent", {
            type: "mouseMoved", x: command.x, y: command.y,
        });
        return readDescriptor(command.tabId);
    }
    if (command.kind === "scroll_target")
        return runScrollPageCommand(interactionRuntime, command);
    throw new Error("UNKNOWN_COMMAND:unsupported page command");
};
const runCommand = async (command, expectedLoaderId) => {
    if (command.kind === "acquire_target")
        return acquireTarget(command);
    await assertDocument(command.tabId, expectedLoaderId);
    if (command.kind === "inspect_target")
        return readDescriptor(command.tabId);
    if ([
        "navigate_target",
        "evaluate_target",
        "click_target",
        "click_dom_target",
        "fill_dom_target",
        "move_target",
        "scroll_target",
    ].includes(command.kind)) {
        return runPageCommand(command);
    }
    return runInteractionCommand(interactionRuntime, command);
};
configureNativeTransport({
    runCommand,
    onDisconnect: () => {
        void detachAllTabs();
    },
});
chrome.runtime.onInstalled.addListener(connectNativeTransport);
chrome.runtime.onStartup.addListener(connectNativeTransport);
chrome.debugger.onDetach.addListener((source) => {
    if (Number.isInteger(source.tabId))
        attachedTabs.delete(source.tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabs.delete(tabId);
});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "grasseye-native-reconnect")
        handleNativeReconnectAlarm();
});
chrome.alarms.create("grasseye-native-reconnect", { periodInMinutes: 0.5 });
connectNativeTransport();
