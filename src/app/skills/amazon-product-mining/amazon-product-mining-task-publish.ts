const AMAZON_MARKETPLACES = [
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.co.jp",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.ca",
  "amazon.com.au",
  "amazon.com.br",
  "amazon.com.mx",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.ae",
  "amazon.sg",
  "amazon.com.tr",
] as const;

const renderAmazonMarketplaceOptions = (): string => AMAZON_MARKETPLACES
  .map((marketplace) => `<option value="${marketplace}">${marketplace}</option>`)
  .join("\n");

export const renderAmazonProductMiningTaskPublish = (): string => `
<section class="panel publish-task-card" data-amazon-product-mining-publish-area>
  <div class="panel-title-row">
    <div>
      <span class="eyebrow">Publish Task Card</span>
      <h2>New keyword mining task</h2>
    </div>
    <span class="status-badge status-watch">governed input</span>
  </div>
  <form class="form-grid compact-form" data-amazon-product-mining-form>
    <div class="field">
      <label>Amazon marketplace</label>
      <select name="amazonMarketplace">${renderAmazonMarketplaceOptions()}</select>
    </div>
    <div class="field"><label>Target market</label><input name="targetMarket" required /></div>
    <div class="field wide"><label>Product direction</label><input name="productDirection" required /></div>
    <div class="field"><label>Requested keyword count</label><input name="requestedKeywordCount" type="number" min="1" value="10" required /></div>
    <div class="field">
      <label>Provider</label>
      <select name="amazonKeywordProviderKind" required>
        <option value="">Select provider</option>
        <option value="gemini-api">Gemini API</option>
        <option value="gemini-web-chat">Gemini web chat</option>
        <option value="gpt-web-chat">GPT web chat</option>
      </select>
    </div>
    <div class="field">
      <label>Language preference</label>
      <select name="languagePreference">
        <option value="en">en</option>
        <option value="zh-CN">zh-CN</option>
        <option value="ja">ja</option>
        <option value="de">de</option>
        <option value="fr">fr</option>
      </select>
    </div>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
      <button class="btn secondary" type="button" data-amazon-product-mining-latest>Latest</button>
      <button class="btn secondary" type="button" data-amazon-product-mining-export>Export</button>
    </div>
  </form>
</section>`;
