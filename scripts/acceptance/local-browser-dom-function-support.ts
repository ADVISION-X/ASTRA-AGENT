import assert from "../audit/shared/governance-exam-assert.js";
import { runInNewContext } from "node:vm";

type Style = Readonly<{ display?: string; visibility?: string; opacity?: string }>;

class FakeElement {
  public isConnected = true;
  public parentElement: FakeElement | null = null;
  public readonly tagName: string;
  public constructor(
    public textContent: string,
    private readonly queries: Readonly<Record<string, readonly FakeElement[]>> = {},
    public readonly style: Style = {},
    private readonly attributes: Readonly<Record<string, string>> = {},
    tagName = "DIV",
  ) { this.tagName = tagName; }
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

const execute = (source: string, document: Readonly<Record<string, unknown>>, input: unknown): unknown => {
  const context = {
    Element: FakeElement,
    document,
    getComputedStyle: (element: FakeElement) => ({
      display: element.style.display ?? "block", visibility: element.style.visibility ?? "visible",
      opacity: element.style.opacity ?? "1", pointerEvents: "auto",
    }),
    innerHeight: 800,
    innerWidth: 1200,
  };
  const implementation = runInNewContext(`(${source})`, context) as (value: unknown) => unknown;
  return implementation(input);
};

export const exerciseCapturedCandidateFunction = (source: string): void => {
  const target = new FakeElement("Run", {}, {}, {}, "BUTTON");
  const scope = new FakeElement("Container text is deliberately not equal to Run", { button: [target] });
  target.parentElement = scope;
  const document = { documentElement: scope, querySelectorAll: (selector: string) => selector === "main" ? [scope] : [],
    elementFromPoint: () => target };
  assert.equal(execute(source, document, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), target, "scope text must not be mistaken for target exact text");
  const excessiveScopes = Array.from({ length: 257 }, () => new FakeElement("scope"));
  assert.equal(execute(source, { ...document, querySelectorAll: () => excessiveScopes }, {
    selector: "button", scope: { selector: "main" },
  }), "BROWSER_DOM_READ_INVALID", "257 scope candidates must fail the whole call");
  const excessiveTargets = Array.from({ length: 256 }, () => new FakeElement("Run"));
  const oneScope = new FakeElement("scope", { button: excessiveTargets });
  assert.equal(execute(source, { ...document, querySelectorAll: () => [oneScope] }, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), "BROWSER_DOM_READ_INVALID", "scope plus target candidates must share the 256 budget");
};

export const exerciseCapturedObservationFunction = (source: string): void => {
  const nodes = [new FakeElement("a", {}, { display: "none" }),
    new FakeElement("b", {}, { visibility: "hidden" }), new FakeElement("c", {}, { opacity: "0" }),
    new FakeElement("d", {}, {}, { inert: "" })];
  const root = new FakeElement("root", { button: nodes });
  for (const node of nodes) node.parentElement = root;
  const result = execute(source, { documentElement: root, querySelectorAll: () => [],
    elementFromPoint: () => null }, [{ queryId: "reasons", selector: "button", maxMatches: 1,
    fields: ["visible"] }]) as Readonly<{ queries: readonly Readonly<{ rejections: readonly unknown[] }>[] }>;
  assert.equal(result.queries[0]?.rejections.length, 4,
    "the executed observation function must retain every rejected candidate");
  assert.equal(JSON.stringify(result.queries[0]?.rejections), JSON.stringify([
    { index: 0, reasons: ["DISPLAY_HIDDEN"] }, { index: 1, reasons: ["VISIBILITY_HIDDEN"] },
    { index: 2, reasons: ["OPACITY_HIDDEN"] }, { index: 3, reasons: ["INERT"] },
  ]));
};
