/** Shared injected serializer for exact GPT text and coherent DOM hashes. */
export const BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE = `
  const browserSemanticBlockNames = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
    "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"]);
  const browserInlineCode = (value) => {
    const runs = Array.from(value.matchAll(/\x60+/g), (match) => match[0].length);
    const fence = "\x60".repeat(Math.max(0, ...runs) + 1);
    return fence + value + fence;
  };
  const browserSemanticNode = (node, parent, insidePre, restoreUserPromptFences) => {
    const name = String(node.nodeName || "").toUpperCase();
    if (node.nodeType === 3 || name === "#TEXT") return typeof node.nodeValue === "string" ? node.nodeValue : "";
    if (["#COMMENT", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH"].includes(name)
      || (node instanceof Element && (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true"))) return "";
    if (name === "BR") return "\\n";
    const nestedInPre = insidePre || name === "PRE";
    const body = Array.from(node.childNodes || [])
      .map((child) => browserSemanticNode(child, node, nestedInPre, restoreUserPromptFences)).join("");
    if (name === "STRONG" || name === "B") return "**" + body + "**";
    if (name === "EM" || name === "I") return "*" + body + "*";
    if (name === "CODE") return insidePre ? body : browserInlineCode(body);
    if (name === "LI") return ((parent && String(parent.nodeName).toUpperCase() === "OL") ? "1. " : "- ") + body + "\\n";
    if (name === "PRE" && restoreUserPromptFences) return "\x60\x60\x60" + body + "\\n\x60\x60\x60";
    return browserSemanticBlockNames.has(name) ? body + "\\n" : body;
  };
  const browserCanonicalSemanticText = (node) => {
    const value = Array.from(node.childNodes || [])
      .map((child) => browserSemanticNode(child, node, false, false)).join("");
    return value.endsWith("\\n") ? value.slice(0, -1) : value;
  };
  const browserCanonicalGptUserPromptText = (node) => {
    const value = Array.from(node.childNodes || [])
      .map((child) => browserSemanticNode(child, node, false, true)).join("");
    return value.endsWith("\\n") ? value.slice(0, -1) : value;
  };
`;
