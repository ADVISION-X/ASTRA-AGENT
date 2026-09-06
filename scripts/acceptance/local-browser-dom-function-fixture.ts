import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

type Style = Readonly<{ display?: string; visibility?: string; opacity?: string; pointerEvents?: string }>;

export class FakeElement {
  public isConnected = true;
  public parentElement: FakeElement | null = null;
  public readonly tagName: string;
  public readonly nodeName: string;
  public get nodeType(): number { return 1; }
  public get nodeValue(): string | null { return null; }
  public constructor(
    public textContent: string,
    private readonly queries: Readonly<Record<string, readonly FakeElement[]>> = {},
    public readonly style: Style = {},
    private readonly attributes: Readonly<Record<string, string>> = {},
    tagName = "DIV",
    public readonly childNodes: readonly FakeElement[] = [],
  ) {
    this.tagName = tagName;
    this.nodeName = tagName;
    for (const child of childNodes) child.parentElement = this;
  }
  public get outerHTML(): string {
    if (this.nodeType === 3 || this.nodeName === "#TEXT") return this.nodeValue ?? "";
    return `<${this.tagName.toLowerCase()}>${this.childNodes.map((child) => child.outerHTML).join("")}</${this.tagName.toLowerCase()}>`;
  }
  public querySelectorAll(selector: string): readonly FakeElement[] { return this.queries[selector] ?? []; }
  public getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; }
  public getClientRects(): readonly object[] { return [{}]; }
  public getAttribute(name: string): string | null { return this.attributes[name] ?? null; }
  public hasAttribute(name: string): boolean { return this.attributes[name] !== undefined; }
  public matches(selector: string): boolean { return selector === ":disabled" && this.hasAttribute("disabled"); }
  public closest(selector: string): FakeElement | null {
    const matches = selector === "[hidden]" ? this.hasAttribute("hidden")
      : selector === "[aria-hidden='true']" ? this.getAttribute("aria-hidden") === "true"
        : selector === "[inert]" ? this.hasAttribute("inert")
          : selector === "[aria-disabled='true']" ? this.getAttribute("aria-disabled") === "true" : false;
    return matches ? this : this.parentElement?.closest(selector) ?? null;
  }
  public contains(element: FakeElement): boolean { return element === this; }
}

export class FakeTextNode extends FakeElement {
  public constructor(value: string) { super(value, {}, {}, {}, "#TEXT"); }
  public override get nodeType(): number { return 3; }
  public override get nodeValue(): string { return this.textContent; }
}

export const RICH_SEMANTIC_TEXT = "Title\nBody `inline`\n- item\n\n{\"ok\":true}\nend";

export const richSemanticTree = (): FakeElement => new FakeElement("rich response", {}, {}, {}, "DIV", [
  new FakeElement("Title", {}, {}, {}, "H1", [new FakeTextNode("Title")]),
  new FakeElement("Body inline", {}, {}, {}, "P", [
    new FakeTextNode("Body "),
    new FakeElement("inline", {}, {}, {}, "CODE", [new FakeTextNode("inline")]),
  ]),
  new FakeElement("item", {}, {}, {}, "UL", [
    new FakeElement("item", {}, {}, {}, "LI", [new FakeTextNode("item")]),
  ]),
  new FakeElement('{"ok":true}', {}, {}, {}, "PRE", [
    new FakeElement('{"ok":true}', {}, {}, {}, "CODE", [new FakeTextNode('{"ok":true}')]),
  ]),
  new FakeElement("end", {}, {}, {}, "P", [new FakeTextNode("end")]),
]);

export const execute = (source: string, document: Readonly<Record<string, unknown>>, input: unknown,
  href = "https://chatgpt.com/"): unknown => {
  const context = {
    Element: FakeElement,
    URL,
    document,
    location: Object.freeze({ href }),
    crypto: globalThis.crypto,
    TextEncoder,
    getComputedStyle: (element: FakeElement) => ({
      display: element.style.display ?? "block", visibility: element.style.visibility ?? "visible",
      opacity: element.style.opacity ?? "1", pointerEvents: element.style.pointerEvents ?? "auto",
    }),
    innerHeight: 800,
    innerWidth: 1200,
  };
  const implementation = runInNewContext(`(${source})`, context) as (value: unknown) => unknown;
  return implementation(input);
};

export const hash = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
