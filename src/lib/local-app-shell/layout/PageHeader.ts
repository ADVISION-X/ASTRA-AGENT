import { escapeHtml, joinHtml } from "../render-utils.js";

export function renderPageHeader(title: string, subtitle: string, actions = ""): string {
  return joinHtml([
    `<header class="cc-page-header">`,
    `  <div>`,
    `    <h2>${escapeHtml(title)}</h2>`,
    `    <p>${escapeHtml(subtitle)}</p>`,
    `  </div>`,
    actions,
    `</header>`,
  ]);
}