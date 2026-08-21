export const WORKBENCH_EXTENSION_CHANNEL_PORT_NAME = "grasseye-browser-authority-v1";
export const GRASSEYE_BROWSER_EXTENSION_ID = "emkmbecadncngofidjgocmifhbonifgm";

export const renderWorkbenchBrowserExtensionChannelClient = (): string => `
const openWorkbenchExtensionChannel = async () => {
  const opened = await fetch("/api/browser-extension-channel/open", { method: "POST" }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.failureReason || body.error || "extension channel open failed");
    return body;
  });
  const pageSessionGrant = opened.pageSessionGrant;
  const runtime = window.chrome && window.chrome.runtime;
  if (!runtime || !pageSessionGrant) return;
  const extensionId = opened.extensionId || "emkmbecadncngofidjgocmifhbonifgm";
  const portName = opened.portName || "grasseye-browser-authority-v1";
  const port = runtime.connect(extensionId, { name: portName });
  const forward = async (frame) => {
    await fetch("/api/browser-extension-channel/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant: pageSessionGrant, frame }),
    });
  };
  port.onMessage.addListener((frame) => forward(frame).catch(() => port.disconnect()));
  port.onDisconnect.addListener(() => undefined);
  port.postMessage({ kind: "workbench-page-open", pageSessionGrant });
  const poll = async () => {
    const response = await fetch("/api/browser-extension-channel/next?grant=" + encodeURIComponent(pageSessionGrant));
    if (!response.ok) throw new Error("extension channel poll failed");
    const body = await response.json();
    if (body.frame) port.postMessage(body.frame);
    if (port) window.setTimeout(() => poll().catch(() => port.disconnect()), 250);
  };
  poll().catch(() => port.disconnect());
};
openWorkbenchExtensionChannel().catch(() => undefined);
`;
