import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import type { ProductPluginOutput, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";

export interface ResearchBriefInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}

type Node = DefaultTreeAdapterMap["childNode"];
const tags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote",
  "div", "section", "article", "dl", "dd", "dt", "figure", "figcaption", "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td", "strong", "em", "b", "i", "del", "pre", "code", "a"]);
const excluded = new Set(["script", "style", "noscript", "template", "svg", "path"]);
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function safeLink(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password
      || (url.hostname === "chatgpt.com" && url.pathname.startsWith("/c/"))) return null;
    return url.href;
  } catch { return null; }
}

function outlineNode(node: Node): string {
  if ("value" in node) return escape(node.value);
  if (!("tagName" in node) || excluded.has(node.tagName)
    || node.attrs.some(({ name, value }) => name === "hidden" || name === "aria-hidden" && value === "true")) return "";
  const tag = node.tagName;
  if (tag === "br" || tag === "hr") return `<${tag}>`;
  const content = node.childNodes.map(outlineNode).join("");
  if (node.namespaceURI !== "http://www.w3.org/1999/xhtml") return content;
  if (tag === "a") {
    const href = safeLink(node.attrs.find(attr => attr.name === "href")?.value);
    return href ? `<a href="${escape(href)}">${content}</a>` : content;
  }
  return tags.has(tag) ? `<${tag}>${content}</${tag}>` : content;
}

function outlineStructure(raw: string): string | null {
  try {
    const projected = parseFragment(raw).childNodes.map(outlineNode).join("");
    return projected && Buffer.byteLength(projected) <= 1_048_576 ? projected : null;
  } catch { return null; }
}

export function buildResearchBriefResult(task: WebsiteAgentTask, answer: {
  semanticText: string; rawDomHtml: string;
}, artifacts: readonly string[]): ProductPluginOutput {
  const [checkpoint] = artifacts;
  if (artifacts.length !== 1 || !checkpoint) throw new Error("S01_ADOPTED_CHECKPOINT_MISSING");
  return {
    payload: {
      schema_version: "astra-research-brief.v2",
      submission_id: task.parameters.submission_id,
      project_id: task.business_identity.subject_ref,
      input_version: task.parameters.input_version,
      tier: task.parameters.research_tier,
      outline_text: answer.semanticText,
      outline_structure: outlineStructure(answer.rawDomHtml),
    },
    evidence_refs: [checkpoint],
  };
}
