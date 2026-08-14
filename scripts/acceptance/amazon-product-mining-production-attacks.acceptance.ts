import assert from "node:assert/strict";

import { chromium, type Browser, type Page } from "playwright";

import type { BrowserActionResult, BrowserTargetSession } from "../../src/lib/browser/browser-controller.js";
import { runProductDetailExtraction } from "../../src/plugins/amazon-product-mining/amazon-product-mining.product-detail.js";
import { runReviewPagination } from "../../src/plugins/amazon-product-mining/amazon-product-mining.reviews.js";
import { runAmazonSearch } from "../../src/plugins/amazon-product-mining/amazon-product-mining.search.js";

const now = () => new Date().toISOString();

const ok = (message: string): BrowserActionResult => ({
  browserActionId: `attack-${Date.now()}`,
  ok: true,
  message,
  createdAt: now(),
});

class AttackBrowser implements BrowserTargetSession {
  private constructor(private readonly browser: Browser, private readonly page: Page) {}

  static async create(): Promise<AttackBrowser> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    return new AttackBrowser(browser, page);
  }

  getHealth() { return { ok: true, detail: "attack-browser" }; }
  getSessionState() { return { currentUrl: this.page.url(), currentTitle: "attack-browser", open: true } as ReturnType<BrowserTargetSession["getSessionState"]>; }
  async getGeometrySnapshot() { return { currentUrl: this.page.url(), pageTitle: "attack-browser" } as Awaited<ReturnType<BrowserTargetSession["getGeometrySnapshot"]>>; }
  async scroll() { return ok("scroll ignored in attack browser"); }
  async click() { return ok("click ignored in attack browser"); }
  async clickLocatedDomElement() { return ok("located click ignored in attack browser"); }
  async textInput() { return ok("text input ignored in attack browser"); }
  async screenshotRegion() { return { browserActionId: "attack", pageUrl: this.page.url(), pageTitle: "attack", regionLabel: "attack", regionType: "viewport", width: 1, height: 1, viewportWidth: 1, viewportHeight: 1, sourceFilePath: "/tmp/attack.png", createdAt: now() }; }
  async setFileInputFiles() { return ok("file input ignored in attack browser"); }
  async wait() { return ok("wait ignored in attack browser"); }
  async closeTarget() { return ok("active tab close ignored in attack browser"); }
  async close() { await this.browser.close(); return ok("attack browser closed"); }

	  async open(input: { url: string }): Promise<BrowserActionResult> {
	    if (input.url.includes("/s?k=attack%20search") || input.url.includes("/s?k=attack+search")) {
	      await this.page.setContent(buildSearchAttackHtml(), { waitUntil: "domcontentloaded" });
	      return ok("opened attacked search page");
	    }
	    if (input.url.includes("captcha-search")) {
	      await this.page.setContent("<html><body><input id=\"captchacharacters\" /></body></html>", { waitUntil: "domcontentloaded" });
	      return ok("opened captcha search page");
	    }
	    if (input.url.includes("/dp/B0ATTACK01")) {
	      await this.page.setContent(buildDetailAttackHtml(), { waitUntil: "domcontentloaded" });
	      return ok("opened attacked detail page");
	    }
	    if (input.url.includes("pageNumber=2")) {
	      await this.page.setContent(buildReviewAttackHtml({ page: 2 }), { waitUntil: "domcontentloaded" });
	      return ok("opened attacked review page 2");
	    }
	    if (input.url.includes("/product-reviews/B0ATTACK01")) {
	      await this.page.setContent(buildReviewAttackHtml({ page: 1 }), { waitUntil: "domcontentloaded" });
	      return ok("opened attacked review page 1");
	    }
	    await this.page.setContent("<html><body>empty attack fixture</body></html>", { waitUntil: "domcontentloaded" });
    return ok("opened empty attack fixture");
  }

  async evaluate<T>(input: { script: string }): Promise<T> {
    return this.page.evaluate((script) => {
      const execute = new Function(script);
      return execute();
    }, input.script) as Promise<T>;
  }
}

const buildSearchAttackHtml = (): string => {
  const cards = Array.from({ length: 23 }, (_, index) => {
    const rank = index + 1;
    const asin = rank === 2 ? "" : `B0ATTACK${String(rank).padStart(2, "0")}`;
    const sponsor = rank === 1 ? "<span class=\"s-sponsored-label-text\">Sponsored</span>" : "";
    return `
      <div data-component-type="s-search-result" data-asin="${asin}">
        ${sponsor}
        <h2><a href="/Attack-Product-${rank}/dp/B0ATTACK${String(rank).padStart(2, "0")}"><span>Attack Product ${rank}</span></a></h2>
        <img class="s-image" src="https://example.test/image-${rank}.jpg" />
        <span class="a-price"><span class="a-offscreen">AED${rank}.00</span></span>
        <i class="a-icon-star-small"><span class="a-icon-alt">4.${rank % 10} out of 5 stars</span></i>
        <span class="a-size-base s-underline-text">${rank * 3} ratings</span>
        <span data-cy="delivery-recipe">FREE delivery tomorrow</span>
      </div>
    `;
  }).join("");
  return `<html><body><main>${cards}</main></body></html>`;
};

const buildDetailAttackHtml = (): string => `
  <html>
    <body>
      <input name="ASIN" value="B0ATTACK01" />
      <div id="productTitle">Attack Detail ‎ Product</div>
      <a id="bylineInfo">Visit the AttackBrand Store</a>
      <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">AED42.00</span></span></div>
      <img id="landingImage" data-old-hires="https://example.test/detail-main.jpg" />
      <div id="altImages"><img src="https://example.test/detail-alt.jpg" /></div>
      <div id="feature-bullets"><ul><li><span class="a-list-item">Noise heavy bullet one</span></li><li><span class="a-list-item">Noise heavy bullet two</span></li></ul></div>
      <div id="productDescription"><p>Attack product description survives noisy DOM.</p></div>
      <table id="productDetails_techSpec_section_1"><tr><th>Material</th><td>Stainless steel</td></tr></table>
      <div id="detailBulletsWrapper_feature_div">Best Sellers Rank #9 in Water Dispensers</div>
      <div id="acrPopover"><span class="a-icon-alt">4.6 out of 5 stars</span></div>
      <span id="acrCustomerReviewText">128 ratings</span>
      <div id="availability">In Stock</div>
    </body>
  </html>
`;

const buildReviewAttackHtml = (input: { page: 1 | 2 }): string => {
  const next = input.page === 1 ? "<li class=\"a-last\"><a href=\"?pageNumber=2\">Next</a></li>" : "<li class=\"a-last a-disabled\">Next</li>";
  const reviewId = input.page === 1 ? "RATTACK01" : "RATTACK02";
  return `
    <html lang="en-AE">
      <body>
        <div data-hook="review" id="${reviewId}">
          <span class="a-profile-name">Reviewer ${input.page}</span>
          <i data-hook="review-star-rating"><span class="a-icon-alt">5.0 out of 5 stars</span></i>
          <a data-hook="review-title"><span>Ignored</span><span>Attack review title ${input.page}</span></a>
          <span data-hook="review-body"><span>Attack review body ${input.page}</span></span>
          <span data-hook="review-date">Reviewed in the United Arab Emirates on May ${input.page}, 2026</span>
          <span data-hook="avp-badge">Verified Purchase</span>
          <span data-hook="format-strip-linkless">Color: Black</span>
          <span data-hook="helpful-vote-statement">${input.page} people found this helpful</span>
        </div>
        <ul>${next}</ul>
      </body>
    </html>
  `;
};

const browser = await AttackBrowser.create();
try {
  const searchResult = await runAmazonSearch({
    browser,
    marketplace: "amazon.ae",
    keyword: "attack search",
    keywordId: "keyword-attack",
    taskId: "task-attack",
  });
	  assert.equal(searchResult.ok, true, `attack 1 search extraction should survive chunked noisy first page: ${JSON.stringify(searchResult)}`);
  if (!searchResult.ok) throw new Error("search attack unexpectedly failed");
  assert.equal(searchResult.items.length, 23);
  assert.equal(searchResult.items[0]!.isSponsored, true);
  assert.equal(searchResult.items[1]!.asinIfAvailable, null);
  assert.equal(searchResult.items[22]!.rankPosition, 23);

  const captchaResult = await runAmazonSearch({
    browser,
    marketplace: "amazon.ae",
    keyword: "captcha-search",
    keywordId: "keyword-captcha",
    taskId: "task-attack",
  });
  assert.equal(captchaResult.ok, false, "attack 2 captcha must not be bypassed");
  if (captchaResult.ok) throw new Error("captcha attack unexpectedly succeeded");
  assert.equal(captchaResult.blockerKind, "captcha");

  const detail = await runProductDetailExtraction({
    browser,
    productUrl: "https://www.amazon.ae/Attack-Detail/dp/B0ATTACK01",
    asin: "B0ATTACK01",
    taskId: "task-attack",
  });
  assert.equal(detail.asin, "B0ATTACK01");
  assert.equal(detail.brand, "AttackBrand");
  assert.equal(detail.currentPrice, "AED42.00");
  assert.equal(detail.allVisibleImages.length, 2);
  assert.ok(detail.rawVisibleTextSnapshot, "attack 3 detail raw evidence should be retained");
  assert.ok(detail.rawVisibleTextSnapshot.includes("Attack product description"), "attack 3 detail raw evidence should include the attack description");

  const capturedPages: number[] = [];
  const reviewResult = await runReviewPagination({
    browser,
    reviewsUrl: "https://www.amazon.ae/product-reviews/B0ATTACK01",
    detailId: "detail-attack",
    taskId: "task-attack",
    asin: "B0ATTACK01",
    onPageExtracted: async (reviews, pageIndex) => {
      capturedPages.push(pageIndex);
      assert.equal(reviews.length, 1);
      assert.equal(reviews[0]!.reviewRegionIfVisible, "the United Arab Emirates");
    },
  });
  assert.deepEqual(capturedPages, [0, 1], "attack 4 reviews must persist every accessible page in order");
  assert.equal(reviewResult.totalReviewsCollected, 2);
  assert.equal(reviewResult.totalPagesVisited, 2);
} finally {
  await browser.close();
}

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-production-attacks\n");
