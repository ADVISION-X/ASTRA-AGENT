import { joinHtml } from "../render-utils.js";

export function renderAppFrame(parts: {
  statusBar: string;
  router: string;
  bottomNav: string;
}): string {
  return joinHtml([
    `<div class="cc-app-preview-shell">`,
    `  <div class="cc-app-preview-frame" data-app-shell>`,
    parts.statusBar,
    `    <div class="cc-app-viewport">${parts.router}</div>`,
    parts.bottomNav,
    `  </div>`,
    `</div>`,
  ]);
}